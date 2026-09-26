import json
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse, Response
from app.dependencies import require_api_key
from app.providers.base import Capability
from app.schemas import ChatRequest, EmbeddingRequest, ImageRequest, SpeechRequest

router = APIRouter()
protected = [Depends(require_api_key)]


def error_response(status: int, code: str, message: str):
    return JSONResponse(status_code=status, content={"error": {"type": "gateway_error", "code": code, "message": message}})


def provider_or_error(request: Request, provider_id: str | None, capability: Capability, model: str | None = None):
    try:
        if model:
            return request.app.state.registry.resolve(model, capability, provider_id)
        return request.app.state.registry.require(provider_id, capability), model
    except KeyError:
        code = "model_not_found" if model and not provider_id else "provider_not_found"
        target = model or provider_id
        raise HTTPException(status_code=404, detail={"type": "gateway_error", "code": code, "message": f"Unknown route target: {target}"})
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail={"type": "gateway_error", "code": "capability_not_supported", "message": str(exc)})


@router.get("/health")
async def health(request: Request):
    return {"status": "ok", "service": request.app.state.settings.app_name}


@router.get("/providers", dependencies=protected)
async def providers(request: Request):
    return {"data": request.app.state.registry.infos()}


@router.get("/models", dependencies=protected)
async def models(request: Request, provider: str | None = None):
    selected = [provider] if provider else list(request.app.state.registry.providers)
    data = []
    for provider_id in selected:
        adapter, _ = provider_or_error(request, provider_id, Capability.MODELS)
        for model in await adapter.list_models():
            configured_capabilities = model.get("capabilities") or sorted(c.value for c in adapter.capabilities)
            data.append({"id": model.get("id"), "provider": provider_id, "owned_by": model.get("owned_by", provider_id), "capabilities": configured_capabilities})
    return {"data": data}


@router.post("/chat/completions", dependencies=protected)
async def chat(request: Request, payload: ChatRequest):
    capability = Capability.CHAT_STREAM if payload.stream else Capability.CHAT
    adapter, resolved_model = provider_or_error(request, payload.provider, capability, payload.model)
    if resolved_model != payload.model:
        payload = payload.model_copy(update={"model": resolved_model})
    if payload.stream:
        async def events():
            try:
                async for chunk in adapter.chat_stream(payload):
                    yield f"data: {chunk}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'error': {'type': 'upstream_error', 'code': 'provider_error', 'message': str(exc)}})}\n\n"
        return StreamingResponse(events(), media_type="text/event-stream")
    try:
        result = await adapter.chat(payload)
        return {"id": result.id, "object": "chat.completion", "model": result.model, "choices": [{"index": 0, "message": {"role": "assistant", "content": result.content}, "finish_reason": "stop"}], "usage": result.usage, "provider": result.provider}
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))


@router.post("/embeddings", dependencies=protected)
async def embeddings(request: Request, payload: EmbeddingRequest):
    adapter, resolved_model = provider_or_error(request, payload.provider, Capability.EMBEDDINGS, payload.model)
    if resolved_model != payload.model:
        payload = payload.model_copy(update={"model": resolved_model})
    try:
        result = await adapter.embeddings(payload)
        return result.model_dump()
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))


@router.post("/images/generations", dependencies=protected)
async def images(request: Request, payload: ImageRequest):
    adapter, resolved_model = provider_or_error(request, payload.provider, Capability.IMAGES, payload.model)
    if resolved_model != payload.model:
        payload = payload.model_copy(update={"model": resolved_model})
    try:
        return (await adapter.images(payload)).model_dump()
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))


@router.post("/audio/transcriptions", dependencies=protected)
async def transcriptions(request: Request, file: UploadFile = File(...), provider: str = Form("openai"), model: str = Form(...)):
    adapter, _ = provider_or_error(request, provider, Capability.TRANSCRIPTIONS, model)
    try:
        return (await adapter.transcriptions(await file.read(), file.filename or "audio", model, provider)).model_dump()
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))


@router.post("/audio/speech", dependencies=protected)
async def speech(request: Request, payload: SpeechRequest):
    adapter, resolved_model = provider_or_error(request, payload.provider, Capability.SPEECH, payload.model)
    if resolved_model != payload.model:
        payload = payload.model_copy(update={"model": resolved_model})
    try:
        result = await adapter.speech(payload)
        return Response(content=result.content, media_type=result.media_type)
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))

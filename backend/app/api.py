import json
import tempfile
from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
from app.dependencies import require_api_key
from app.pose.jobs import PoseJobError
from app.pose.schemas import JobRecord
from app.providers.base import Capability
from app.schemas import ChatRequest, EmbeddingRequest, ImageRequest, SpeechRequest

router = APIRouter()
protected = [Depends(require_api_key)]


class PoseUploadError(ValueError):
    """Validation error with a stable code exposed by the pose API."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def pose_error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"type": "pose_error", "code": code, "message": message}},
    )


def validate_pose_upload(
    path: str | Path,
    filename: str | None = None,
    content_type: str | None = None,
    settings=None,
    size_bytes: int | None = None,
) -> tuple[float, int]:
    """Validate an uploaded MP4 and return its FPS and frame count.

    The function is kept separate from the route so deployments can replace
    it with a faster media probe and tests can inject deterministic validation.
    """

    if filename and Path(filename).suffix.lower() != ".mp4":
        raise PoseUploadError("unsupported_media", "Only MP4 videos are supported")
    media_type = content_type.split(";", 1)[0].strip().lower() if content_type else ""
    allowed_types = {"", "video/mp4", "application/octet-stream", "video/x-m4v"}
    if media_type not in allowed_types:
        raise PoseUploadError("unsupported_media", "Only MP4 videos are supported")
    if settings is None:
        # Import lazily so importing the gateway does not require pose runtime
        # dependencies in environments that only use provider routes.
        from app.config import get_settings

        settings = get_settings()
    if size_bytes is not None and size_bytes > settings.pose_max_upload_bytes:
        raise PoseUploadError(
            "unsupported_media",
            f"Video exceeds the {settings.pose_max_upload_bytes} byte upload limit",
        )

    capture = cv2.VideoCapture(str(path))
    try:
        if not capture.isOpened():
            raise PoseUploadError("decode_error", "Unable to open uploaded video")
        fps = float(capture.get(cv2.CAP_PROP_FPS))
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        if fps <= 0 or frame_count < 1:
            raise PoseUploadError("decode_error", "Uploaded video contains no readable frames")
        duration = frame_count / fps
        if duration > settings.pose_max_duration_seconds:
            raise PoseUploadError(
                "unsupported_media",
                f"Video exceeds the {settings.pose_max_duration_seconds} second duration limit",
            )
        return fps, frame_count
    finally:
        capture.release()


def _pose_record_payload(request: Request, record: JobRecord) -> dict:
    payload = record.model_dump(mode="json")
    if record.status.value == "succeeded":
        base = f"/api/v1/pose/jobs/{record.job_id}"
        payload["outputs"] = {
            "video_url": f"{base}/video",
            "frames_url": f"{base}/frames",
            "summary_url": f"{base}/summary",
        }
    return payload


def _pose_route_error(exc: PoseJobError) -> JSONResponse:
    status = {
        "not_found": 404,
        "busy": 429,
        "invalid_state": 409,
        "storage_error": 500,
    }.get(exc.code, 400)
    return pose_error_response(status, exc.code, exc.message)


def error_response(status: int, code: str, message: str):
    return JSONResponse(
        status_code=status,
        content={"error": {"type": "gateway_error", "code": code, "message": message}},
    )


def provider_or_error(
    request: Request, provider_id: str | None, capability: Capability, model: str | None = None
):
    try:
        if model:
            return request.app.state.registry.resolve(model, capability, provider_id)
        return request.app.state.registry.require(provider_id, capability), model
    except KeyError:
        code = "model_not_found" if model and not provider_id else "provider_not_found"
        target = model or provider_id
        raise HTTPException(
            status_code=404,
            detail={
                "type": "gateway_error",
                "code": code,
                "message": f"Unknown route target: {target}",
            },
        )
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=501,
            detail={
                "type": "gateway_error",
                "code": "capability_not_supported",
                "message": str(exc),
            },
        )


@router.get("/health")
async def health(request: Request):
    return {"status": "ok", "service": request.app.state.settings.app_name}


@router.post("/pose/jobs", dependencies=protected, status_code=202)
async def create_pose_job(request: Request, file: UploadFile = File(...)):
    """Validate, persist, and start an asynchronous player-pose job."""

    settings = request.app.state.settings
    if not file.filename:
        return pose_error_response(415, "unsupported_media", "An MP4 filename is required")

    temporary_path: Path | None = None
    size_bytes = 0
    try:
        storage_dir = Path(settings.pose_storage_dir)
        storage_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="wb", suffix=".mp4", prefix="pose-upload-", dir=storage_dir, delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > settings.pose_max_upload_bytes:
                    raise PoseUploadError(
                        "unsupported_media",
                        f"Video exceeds the {settings.pose_max_upload_bytes} byte upload limit",
                    )
                temporary.write(chunk)

        # Positional arguments intentionally keep this hook easy to replace in
        # tests and in deployments with a custom media probe.
        validate_pose_upload(
            temporary_path,
            file.filename,
            file.content_type,
            settings,
            size_bytes,
        )
        manager = request.app.state.pose_jobs
        record = manager.create(temporary_path, file.filename)
        try:
            running = manager.start(record.job_id)
            record = running
        except PoseJobError as exc:
            return _pose_route_error(exc)
        payload = {
            "job_id": record.job_id,
            "status": record.status.value,
            "poll_url": f"/api/v1/pose/jobs/{record.job_id}",
        }
        return JSONResponse(status_code=202, content=payload)
    except PoseUploadError as exc:
        return pose_error_response(415, exc.code, exc.message)
    except PoseJobError as exc:
        return _pose_route_error(exc)
    except (OSError, ValueError) as exc:
        return pose_error_response(500, "storage_error", f"Unable to store uploaded video: {exc}")
    finally:
        await file.close()
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass


@router.get("/pose/jobs/{job_id}", dependencies=protected, name="pose_status")
async def pose_status(request: Request, job_id: str):
    try:
        record = request.app.state.pose_jobs.get(job_id)
    except PoseJobError as exc:
        return _pose_route_error(exc)
    return _pose_record_payload(request, record)


def _pose_artifact_response(request: Request, job_id: str, artifact: str):
    try:
        path = request.app.state.pose_jobs.artifact_path(job_id, artifact)
    except PoseJobError as exc:
        return _pose_route_error(exc)
    media_type = {
        "video": "video/mp4",
        "frames": "application/x-ndjson",
        "summary": "application/json",
    }[artifact]
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.get("/pose/jobs/{job_id}/video", dependencies=protected)
async def pose_video(request: Request, job_id: str):
    return _pose_artifact_response(request, job_id, "video")


@router.get("/pose/jobs/{job_id}/frames", dependencies=protected)
async def pose_frames(request: Request, job_id: str):
    return _pose_artifact_response(request, job_id, "frames")


@router.get("/pose/jobs/{job_id}/summary", dependencies=protected)
async def pose_summary(request: Request, job_id: str):
    return _pose_artifact_response(request, job_id, "summary")


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
            configured_capabilities = model.get("capabilities") or sorted(
                c.value for c in adapter.capabilities
            )
            data.append(
                {
                    "id": model.get("id"),
                    "provider": provider_id,
                    "owned_by": model.get("owned_by", provider_id),
                    "capabilities": configured_capabilities,
                }
            )
    return {"data": data}


@router.post("/chat/completions", dependencies=protected)
async def chat(request: Request, payload: ChatRequest):
    capability = Capability.CHAT_STREAM if payload.stream else Capability.CHAT
    adapter, resolved_model = provider_or_error(
        request, payload.provider, capability, payload.model
    )
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
        return {
            "id": result.id,
            "object": "chat.completion",
            "model": result.model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": result.content},
                    "finish_reason": "stop",
                }
            ],
            "usage": result.usage,
            "provider": result.provider,
        }
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))


@router.post("/embeddings", dependencies=protected)
async def embeddings(request: Request, payload: EmbeddingRequest):
    adapter, resolved_model = provider_or_error(
        request, payload.provider, Capability.EMBEDDINGS, payload.model
    )
    if resolved_model != payload.model:
        payload = payload.model_copy(update={"model": resolved_model})
    try:
        result = await adapter.embeddings(payload)
        return result.model_dump()
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))


@router.post("/images/generations", dependencies=protected)
async def images(request: Request, payload: ImageRequest):
    adapter, resolved_model = provider_or_error(
        request, payload.provider, Capability.IMAGES, payload.model
    )
    if resolved_model != payload.model:
        payload = payload.model_copy(update={"model": resolved_model})
    try:
        return (await adapter.images(payload)).model_dump()
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))


@router.post("/audio/transcriptions", dependencies=protected)
async def transcriptions(
    request: Request,
    file: UploadFile = File(...),
    provider: str = Form("openai"),
    model: str = Form(...),
):
    adapter, _ = provider_or_error(request, provider, Capability.TRANSCRIPTIONS, model)
    try:
        return (
            await adapter.transcriptions(
                await file.read(), file.filename or "audio", model, provider
            )
        ).model_dump()
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))


@router.post("/audio/speech", dependencies=protected)
async def speech(request: Request, payload: SpeechRequest):
    adapter, resolved_model = provider_or_error(
        request, payload.provider, Capability.SPEECH, payload.model
    )
    if resolved_model != payload.model:
        payload = payload.model_copy(update={"model": resolved_model})
    try:
        result = await adapter.speech(payload)
        return Response(content=result.content, media_type=result.media_type)
    except Exception as exc:
        return error_response(502, "provider_error", str(exc))

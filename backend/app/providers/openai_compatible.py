import json
import time
from typing import AsyncIterator
import httpx
from app.providers.base import Capability
from app.schemas import ChatRequest, ChatResult, EmbeddingRequest, EmbeddingResult, ImageRequest, ImageResult, SpeechRequest, SpeechResult, TranscriptionResult


class OpenAICompatibleProvider:
    def __init__(self, provider_id: str, display_name: str, base_url: str, api_key: str, models: list[dict] | None = None, client: httpx.AsyncClient | None = None):
        self.provider_id = provider_id
        self.display_name = display_name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.models = models or []
        self.client = client or httpx.AsyncClient(timeout=60)
        self.configured = bool(api_key)
        self.capabilities = {Capability.CHAT, Capability.CHAT_STREAM, Capability.EMBEDDINGS, Capability.IMAGES, Capability.TRANSCRIPTIONS, Capability.SPEECH, Capability.MODELS}

    def _headers(self):
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    async def _json(self, method: str, path: str, **kwargs):
        response = await self.client.request(method, f"{self.base_url}{path}", headers=self._headers(), **kwargs)
        if response.status_code >= 400:
            raise RuntimeError(f"{self.provider_id} upstream error {response.status_code}: {response.text[:500]}")
        return response.json()

    async def chat(self, request: ChatRequest) -> ChatResult:
        payload = {"model": request.model, "messages": [m.model_dump(exclude_none=True) for m in request.messages]}
        for key in ("temperature", "max_tokens", "tools"):
            value = getattr(request, key)
            if value is not None:
                payload[key] = value
        payload.update(request.extra)
        data = await self._json("POST", "/chat/completions", json=payload)
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        return ChatResult(id=data.get("id", "chatcmpl-local"), model=data.get("model", request.model), content=message.get("content", ""), provider=self.provider_id, usage=data.get("usage") or {})

    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[str]:
        payload = {"model": request.model, "messages": [m.model_dump(exclude_none=True) for m in request.messages], "stream": True}
        payload.update(request.extra)
        async with self.client.stream("POST", f"{self.base_url}/chat/completions", headers=self._headers(), json=payload) as response:
            if response.status_code >= 400:
                raise RuntimeError(f"{self.provider_id} upstream error {response.status_code}")
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    data = line[5:].strip()
                    if data:
                        yield data

    async def embeddings(self, request: EmbeddingRequest) -> EmbeddingResult:
        payload = {"model": request.model, "input": request.input, **request.extra}
        if request.dimensions:
            payload["dimensions"] = request.dimensions
        data = await self._json("POST", "/embeddings", json=payload)
        return EmbeddingResult(model=data.get("model", request.model), data=data.get("data", []), usage=data.get("usage") or {})

    async def images(self, request: ImageRequest) -> ImageResult:
        payload = {"model": request.model, "prompt": request.prompt, "n": request.n, **request.extra}
        for key in ("size", "response_format"):
            value = getattr(request, key)
            if value:
                payload[key] = value
        data = await self._json("POST", "/images/generations", json=payload)
        return ImageResult(created=data.get("created", int(time.time())), data=data.get("data", []))

    async def transcriptions(self, file_bytes: bytes, filename: str, model: str, provider: str) -> TranscriptionResult:
        response = await self.client.post(f"{self.base_url}/audio/transcriptions", headers={"Authorization": f"Bearer {self.api_key}"}, files={"file": (filename, file_bytes)}, data={"model": model})
        if response.status_code >= 400:
            raise RuntimeError(f"{self.provider_id} upstream error {response.status_code}")
        data = response.json()
        return TranscriptionResult(text=data.get("text", ""), language=data.get("language"), duration=data.get("duration"))

    async def speech(self, request: SpeechRequest) -> SpeechResult:
        payload = {"model": request.model, "input": request.input, "voice": request.voice, "response_format": request.response_format, **request.extra}
        if request.speed:
            payload["speed"] = request.speed
        response = await self.client.post(f"{self.base_url}/audio/speech", headers=self._headers(), json=payload)
        if response.status_code >= 400:
            raise RuntimeError(f"{self.provider_id} upstream error {response.status_code}")
        return SpeechResult(content=response.content, media_type=f"audio/{request.response_format}")

    async def list_models(self) -> list[dict]:
        if self.models:
            return self.models
        if not self.configured:
            defaults = {
                "openai": ["gpt-4o-mini"],
                "deepseek": ["deepseek-chat", "deepseek-reasoner"],
                "kimi": ["moonshot-v1-8k"],
                "zhipu": ["glm-4-flash"],
            }
            return [{"id": item, "owned_by": self.provider_id} for item in defaults.get(self.provider_id, [])]
        data = await self._json("GET", "/models")
        return data.get("data", [])

import httpx
from app.providers.base import Capability
from app.schemas import (
    ChatRequest,
    ChatResult,
    EmbeddingRequest,
    EmbeddingResult,
    ImageRequest,
    ImageResult,
    SpeechRequest,
    SpeechResult,
    TranscriptionResult,
)


class AnthropicProvider:
    provider_id = "anthropic"
    display_name = "Anthropic"
    capabilities = {Capability.CHAT, Capability.MODELS}

    def __init__(
        self,
        base_url: str,
        api_key: str,
        models: list[dict] | None = None,
        client: httpx.AsyncClient | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.models = models or []
        self.client = client or httpx.AsyncClient(timeout=60)
        self.configured = bool(api_key)

    async def chat(self, request: ChatRequest) -> ChatResult:
        system = "\n".join(str(m.content) for m in request.messages if m.role == "system")
        messages = [
            {"role": m.role, "content": m.content} for m in request.messages if m.role != "system"
        ]
        payload = {
            "model": request.model,
            "messages": messages,
            "max_tokens": request.max_tokens or 1024,
            **request.extra,
        }
        if system:
            payload["system"] = system
        response = await self.client.post(
            f"{self.base_url}/v1/messages",
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"anthropic upstream error {response.status_code}: {response.text[:500]}"
            )
        data = response.json()
        text = "".join(item.get("text", "") for item in data.get("content", []))
        return ChatResult(
            id=data.get("id", "msg-local"),
            model=data.get("model", request.model),
            content=text,
            provider=self.provider_id,
            usage=data.get("usage") or {},
        )

    async def chat_stream(self, request):
        raise RuntimeError(
            "Anthropic streaming adapter requires event translation and is not enabled"
        )

    async def embeddings(self, request: EmbeddingRequest) -> EmbeddingResult:
        raise NotImplementedError

    async def images(self, request: ImageRequest) -> ImageResult:
        raise NotImplementedError

    async def transcriptions(
        self, file_bytes: bytes, filename: str, model: str, provider: str
    ) -> TranscriptionResult:
        raise NotImplementedError

    async def speech(self, request: SpeechRequest) -> SpeechResult:
        raise NotImplementedError

    async def list_models(self) -> list[dict]:
        if self.models:
            return self.models
        return [{"id": "claude-3-5-sonnet-latest", "owned_by": "anthropic"}]

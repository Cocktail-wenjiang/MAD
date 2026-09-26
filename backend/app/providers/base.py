from enum import StrEnum
from typing import AsyncIterator, Protocol
from app.schemas import ChatRequest, ChatResult, EmbeddingRequest, EmbeddingResult, ImageRequest, ImageResult, SpeechRequest, SpeechResult, TranscriptionResult


class Capability(StrEnum):
    CHAT = "chat"
    CHAT_STREAM = "chat_stream"
    EMBEDDINGS = "embeddings"
    IMAGES = "images"
    TRANSCRIPTIONS = "transcriptions"
    SPEECH = "speech"
    MODELS = "models"


class ModelProvider(Protocol):
    provider_id: str
    display_name: str
    capabilities: set[Capability]
    configured: bool

    async def chat(self, request: ChatRequest) -> ChatResult: ...
    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[str]: ...
    async def embeddings(self, request: EmbeddingRequest) -> EmbeddingResult: ...
    async def images(self, request: ImageRequest) -> ImageResult: ...
    async def transcriptions(self, file_bytes: bytes, filename: str, model: str, provider: str) -> TranscriptionResult: ...
    async def speech(self, request: SpeechRequest) -> SpeechResult: ...
    async def list_models(self) -> list[dict]: ...

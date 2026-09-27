from typing import Any, Literal
from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    type: str
    code: str
    message: str
    request_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class Message(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: Any
    name: str | None = None


class ChatRequest(BaseModel):
    provider: str | None = None
    model: str
    messages: list[Message] = Field(min_length=1)
    temperature: float | None = Field(default=None, ge=0, le=2)
    max_tokens: int | None = Field(default=None, gt=0)
    stream: bool = False
    tools: list[dict[str, Any]] | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class EmbeddingRequest(BaseModel):
    provider: str | None = None
    model: str
    input: str | list[str]
    dimensions: int | None = Field(default=None, gt=0)
    extra: dict[str, Any] = Field(default_factory=dict)


class ImageRequest(BaseModel):
    provider: str | None = None
    model: str = "dall-e-3"
    prompt: str = Field(min_length=1)
    n: int = Field(default=1, ge=1, le=10)
    size: str | None = None
    response_format: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class SpeechRequest(BaseModel):
    provider: str | None = None
    model: str
    input: str = Field(min_length=1)
    voice: str
    response_format: str = "mp3"
    speed: float | None = Field(default=None, gt=0)
    extra: dict[str, Any] = Field(default_factory=dict)


class ModelInfo(BaseModel):
    id: str
    provider: str
    owned_by: str | None = None
    capabilities: list[str] = Field(default_factory=list)


class ProviderInfo(BaseModel):
    id: str
    name: str
    capabilities: list[str]
    configured: bool


class ChatResult(BaseModel):
    id: str
    model: str
    content: str
    provider: str
    usage: dict[str, Any] = Field(default_factory=dict)


class EmbeddingResult(BaseModel):
    model: str
    data: list[dict[str, Any]]
    usage: dict[str, Any] = Field(default_factory=dict)


class ImageResult(BaseModel):
    created: int
    data: list[dict[str, Any]]


class SpeechResult(BaseModel):
    content: bytes
    media_type: str


class TranscriptionResult(BaseModel):
    text: str
    language: str | None = None
    duration: float | None = None

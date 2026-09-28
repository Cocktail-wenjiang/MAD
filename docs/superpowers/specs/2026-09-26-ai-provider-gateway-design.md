# AI Provider Gateway Design

## Goal

Add an independent Python/FastAPI model gateway to the uni-app project. The gateway exposes one stable API for chat, streaming chat, embeddings, image generation, audio transcription, text-to-speech, model discovery, provider discovery, and health checks.

## Architecture

FastAPI routes validate provider-neutral Pydantic schemas, authenticate callers with an internal API key, select a provider from a registry, and return normalized responses. OpenAI, DeepSeek, Kimi, and Zhipu use a configurable OpenAI-compatible adapter. Anthropic uses a dedicated adapter because its messages and response envelope differ. Provider capabilities are declared and unsupported operations return a normalized 501 error.

Provider credentials and endpoints are environment variables only. The registry is the extension point: a new provider implements the provider protocol, declares capabilities, and registers one entry without changing route contracts.

## API surface

- `GET /api/v1/health`
- `GET /api/v1/providers`
- `GET /api/v1/models`
- `POST /api/v1/chat/completions`
- `POST /api/v1/embeddings`
- `POST /api/v1/images/generations`
- `POST /api/v1/audio/transcriptions`
- `POST /api/v1/audio/speech`

Chat streaming uses SSE and preserves the OpenAI chunk shape. Non-streaming responses use normalized OpenAI-compatible envelopes. Errors include `error.type`, `error.code`, `error.message`, and a request id.

## Reliability and security

The service applies a shared timeout, one bounded retry for transient upstream failures, and redacts credentials from logs. The internal API key is checked through `Authorization: Bearer <BACKEND_API_KEY>` when configured. Empty keys are rejected in production configuration.

## Testing

Tests cover schema validation, registry capabilities, auth, provider routing, unsupported capabilities, SSE output, and adapter normalization using an injected HTTP transport. No real provider keys are needed.

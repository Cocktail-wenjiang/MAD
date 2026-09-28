# AI Provider Gateway Implementation Plan

**Goal:** Add a tested FastAPI gateway with a provider-neutral API for text, embeddings, images, and audio across OpenAI-compatible vendors and Anthropic.

**Architecture:** Routes depend on Pydantic request models and a provider registry. Providers implement one protocol; shared OpenAI-compatible HTTP logic handles OpenAI, DeepSeek, Kimi, and Zhipu while Anthropic has its own adapter. Environment-backed settings keep keys out of source control.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, httpx, pytest, pytest-asyncio.

---

### Task 1: Define failing API contract tests

**Files:**

- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write tests for health, providers, models, auth, and unsupported capabilities.**
- [ ] **Step 2: Run `pytest backend/tests/test_api.py -q` and confirm collection/import failures because the backend does not exist yet.**

### Task 2: Add configuration, schemas, and provider abstractions

**Files:**

- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/providers/base.py`
- Create: `backend/app/providers/registry.py`

- [ ] **Step 1: Implement settings, normalized schemas, capability enum, provider protocol, and registry.**
- [ ] **Step 2: Run the focused tests and confirm only missing route behavior remains.**

### Task 3: Implement HTTP provider adapters

**Files:**

- Create: `backend/app/providers/openai_compatible.py`
- Create: `backend/app/providers/anthropic.py`
- Create: `backend/app/providers/factory.py`

- [ ] **Step 1: Implement shared OpenAI-compatible calls and Anthropic message conversion with injected `httpx.AsyncClient`.**
- [ ] **Step 2: Normalize upstream errors and support SSE chat chunks.**
- [ ] **Step 3: Add adapter tests for request paths, headers, and response normalization.**

### Task 4: Implement FastAPI routes and middleware

**Files:**

- Create: `backend/app/dependencies.py`
- Create: `backend/app/api.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Add auth, request-id, provider selection, and all requested routes.**
- [ ] **Step 2: Add multipart audio handling and `StreamingResponse` for chat SSE.**
- [ ] **Step 3: Run all tests and fix failures.**

### Task 5: Add deployment and integration documentation

**Files:**

- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/README.md`
- Create: `backend/docs/provider-uml.md`
- Create: `backend/Dockerfile`
- Create: `backend/docker-compose.yml`

- [ ] **Step 1: Document environment variables, curl examples, capability behavior, and UML diagrams.**
- [ ] **Step 2: Run `python -m compileall backend/app` and `pytest backend/tests -q`.**

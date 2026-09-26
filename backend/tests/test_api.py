import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client():
    return TestClient(create_app(backend_api_key="test-key"))


def test_health_and_provider_discovery(client):
    assert client.get("/api/v1/health").json()["status"] == "ok"
    providers = client.get("/api/v1/providers", headers={"Authorization": "Bearer test-key"})
    assert providers.status_code == 200
    assert {item["id"] for item in providers.json()["data"]} >= {"openai", "anthropic", "deepseek", "kimi", "zhipu"}


def test_protected_routes_require_internal_key(client):
    response = client.get("/api/v1/models")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_models_are_provider_filterable(client):
    response = client.get(
        "/api/v1/models?provider=deepseek",
        headers={"Authorization": "Bearer test-key"},
    )
    assert response.status_code == 200
    assert all(item["provider"] == "deepseek" for item in response.json()["data"])


def test_unsupported_provider_capability_is_normalized(client):
    response = client.post(
        "/api/v1/images/generations",
        headers={"Authorization": "Bearer test-key"},
        json={"provider": "anthropic", "model": "claude-3-5-sonnet", "prompt": "a bird"},
    )
    assert response.status_code == 501
    assert response.json()["error"]["code"] == "capability_not_supported"


def test_chat_request_is_routed_to_selected_provider(client, monkeypatch):
    from app.providers.base import ChatResult

    async def fake_chat(self, request):
        return ChatResult(id="chat-test", model=request.model, content="hello", provider=self.provider_id)

    monkeypatch.setattr("app.providers.openai_compatible.OpenAICompatibleProvider.chat", fake_chat)
    response = client.post(
        "/api/v1/chat/completions",
        headers={"Authorization": "Bearer test-key"},
        json={
            "provider": "deepseek",
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": "hi"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "hello"


def test_chat_automatically_routes_by_model_without_provider(client, monkeypatch):
    from app.schemas import ChatResult

    async def fake_chat(self, request):
        return ChatResult(id="auto-route", model=request.model, content=self.provider_id, provider=self.provider_id)

    monkeypatch.setattr("app.providers.openai_compatible.OpenAICompatibleProvider.chat", fake_chat)
    response = client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer test-key"},
        json={"model": "deepseek-chat", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "deepseek"


def test_model_prefix_selects_provider_and_strips_prefix(client, monkeypatch):
    from app.schemas import ChatResult

    async def fake_chat(self, request):
        return ChatResult(id="prefixed-route", model=request.model, content=request.model, provider=self.provider_id)

    monkeypatch.setattr("app.providers.openai_compatible.OpenAICompatibleProvider.chat", fake_chat)
    response = client.post(
        "/api/v1/chat/completions",
        headers={"Authorization": "Bearer test-key"},
        json={"model": "kimi/moonshot-v1-8k", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "kimi"
    assert response.json()["model"] == "moonshot-v1-8k"

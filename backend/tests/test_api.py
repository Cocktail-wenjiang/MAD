import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.api import PoseUploadError
from app.pose.jobs import PoseJobError
from app.pose.schemas import JobInput, JobOutputs, JobRecord, JobStatus, JobSummary


@pytest.fixture()
def client():
    return TestClient(create_app(backend_api_key="test-key"))


def test_health_and_provider_discovery(client):
    assert client.get("/api/v1/health").json()["status"] == "ok"
    providers = client.get("/api/v1/providers", headers={"Authorization": "Bearer test-key"})
    assert providers.status_code == 200
    assert {item["id"] for item in providers.json()["data"]} >= {
        "openai",
        "anthropic",
        "deepseek",
        "kimi",
        "zhipu",
    }


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
        return ChatResult(
            id="chat-test", model=request.model, content="hello", provider=self.provider_id
        )

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
        return ChatResult(
            id="auto-route",
            model=request.model,
            content=self.provider_id,
            provider=self.provider_id,
        )

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
        return ChatResult(
            id="prefixed-route",
            model=request.model,
            content=request.model,
            provider=self.provider_id,
        )

    monkeypatch.setattr("app.providers.openai_compatible.OpenAICompatibleProvider.chat", fake_chat)
    response = client.post(
        "/api/v1/chat/completions",
        headers={"Authorization": "Bearer test-key"},
        json={"model": "kimi/moonshot-v1-8k", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "kimi"
    assert response.json()["model"] == "moonshot-v1-8k"


class StubPoseJobs:
    """A deterministic API-only job manager for route contract tests."""

    def __init__(self, root):
        self.root = root
        self.record = None

    def create(self, source, filename):
        job_id = "pose-api-test"
        job_dir = self.root / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        (job_dir / "annotated.mp4").write_bytes(b"fake-mp4")
        (job_dir / "frames.jsonl").write_text('{"frame_index": 0}\n', encoding="utf-8")
        (job_dir / "summary.json").write_text('{"frame_count": 1}\n', encoding="utf-8")
        self.record = JobRecord(
            job_id=job_id,
            status=JobStatus.queued,
            progress=0,
            input=JobInput(filename=filename, duration_ms=100, fps=10),
        )
        return self.record.model_copy(deep=True)

    def start(self, job_id):
        if self.record is None or self.record.job_id != job_id:
            raise PoseJobError("not_found", "Pose job was not found")
        self.record.status = JobStatus.succeeded
        self.record.progress = 1
        self.record.summary = JobSummary(frame_count=1, player_count_max=0, avg_confidence=0)
        self.record.outputs = JobOutputs(
            video_url="annotated.mp4", frames_url="frames.jsonl", summary_url="summary.json"
        )
        return self.record.model_copy(deep=True)

    def get(self, job_id):
        if self.record is None or self.record.job_id != job_id:
            raise PoseJobError("not_found", "Pose job was not found")
        return self.record.model_copy(deep=True)

    def artifact_path(self, job_id, artifact):
        if self.record is None or self.record.job_id != job_id:
            raise PoseJobError("not_found", "Pose artifact was not found")
        path = self.root / job_id / {
            "video": "annotated.mp4",
            "frames": "frames.jsonl",
            "summary": "summary.json",
        }.get(artifact, "missing")
        if not path.is_file():
            raise PoseJobError("not_found", "Pose artifact was not found")
        return path


def test_pose_create_requires_key(client):
    response = client.post(
        "/api/v1/pose/jobs", files={"file": ("x.mp4", b"bad", "video/mp4")}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_pose_upload_status_and_artifacts(client, monkeypatch, tmp_path):
    monkeypatch.setattr("app.api.validate_pose_upload", lambda *_: None)
    client.app.state.pose_jobs = StubPoseJobs(tmp_path)
    headers = {"Authorization": "Bearer test-key"}
    response = client.post(
        "/api/v1/pose/jobs",
        headers=headers,
        files={"file": ("practice.mp4", b"fake", "video/mp4")},
    )
    assert response.status_code == 202
    job_id = response.json()["job_id"]
    assert response.json()["status"] == "succeeded"
    assert response.json()["poll_url"].endswith(job_id)

    status = client.get(f"/api/v1/pose/jobs/{job_id}", headers=headers)
    assert status.status_code == 200
    payload = status.json()
    assert payload["status"] == "succeeded"
    assert payload["outputs"]["video_url"].endswith("/video")
    assert payload["outputs"]["frames_url"].endswith("/frames")
    assert payload["outputs"]["summary_url"].endswith("/summary")

    video = client.get(f"/api/v1/pose/jobs/{job_id}/video", headers=headers)
    frames = client.get(f"/api/v1/pose/jobs/{job_id}/frames", headers=headers)
    summary = client.get(f"/api/v1/pose/jobs/{job_id}/summary", headers=headers)
    assert video.status_code == frames.status_code == summary.status_code == 200
    assert video.headers["content-type"].startswith("video/mp4")
    assert frames.headers["content-type"].startswith("application/x-ndjson")
    assert summary.headers["content-type"].startswith("application/json")


def test_pose_invalid_media_has_stable_error(client, monkeypatch, tmp_path):
    client.app.state.pose_jobs = StubPoseJobs(tmp_path)
    monkeypatch.setattr(
        "app.api.validate_pose_upload",
        lambda *_: (_ for _ in ()).throw(PoseUploadError("unsupported_media", "Only MP4 videos are supported")),
    )
    response = client.post(
        "/api/v1/pose/jobs",
        headers={"Authorization": "Bearer test-key"},
        files={"file": ("practice.mov", b"fake", "video/quicktime")},
    )
    assert response.status_code == 415
    assert response.json() == {
        "error": {
            "type": "pose_error",
            "code": "unsupported_media",
            "message": "Only MP4 videos are supported",
        }
    }


def test_pose_missing_job_has_stable_error(client):
    response = client.get(
        "/api/v1/pose/jobs/pose-missing", headers={"Authorization": "Bearer test-key"}
    )
    assert response.status_code == 404
    assert response.json()["error"]["type"] == "pose_error"
    assert response.json()["error"]["code"] == "not_found"

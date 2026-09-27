# Player Stick Figure Video Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline video analysis pipeline that detects badminton players with the existing SoloShuttlePose 17-point model, renders stick figures over the original video, and exposes job results to the UniApp training screen.

**Architecture:** Add a pose-specific module beside the existing FastAPI model gateway. The API stores one isolated job directory, runs a bounded background worker, and serves status, annotated MP4, JSONL frames, and summary files. The UniApp assessment page uploads MP4, polls the job, and presents the annotated video and detection summary while preserving the current local fallback behavior when the service is unavailable.

**Tech Stack:** FastAPI, Pydantic, OpenCV, PyTorch/TorchVision, pytest, Vue 3/UniApp.

---

## File Map

- Create `backend/app/pose/__init__.py`: pose package exports.
- Create `backend/app/pose/schemas.py`: typed job, player, frame, and summary models.
- Create `backend/app/pose/renderer.py`: COCO-17 keypoint filtering and OpenCV stick-figure drawing.
- Create `backend/app/pose/engine.py`: SoloShuttlePose-compatible model adapter and frame inference interface.
- Create `backend/app/pose/jobs.py`: isolated job directories, state transitions, background execution, and result paths.
- Modify `backend/app/config.py`: pose storage, model path, confidence threshold, and upload limits.
- Modify `backend/app/api.py`: pose job create/status/result routes.
- Modify `backend/app/main.py`: initialize pose job manager without coupling it to the provider registry.
- Modify `backend/requirements.txt`: add OpenCV, NumPy, Torch, and TorchVision with documented installation constraints.
- Create `backend/tests/test_pose_renderer.py`: renderer and serialization tests.
- Create `backend/tests/test_pose_jobs.py`: job lifecycle tests with a mocked engine.
- Modify `backend/tests/test_api.py`: authenticated pose route tests.
- Create `utils/pose-analysis.js`: client validation, API calls, polling, and fallback normalization.
- Modify `pages/assessment/assessment.vue`: upload, progress, annotated video, result summary, retry, and local fallback states.
- Modify `components/VideoUploadCard.vue`: expose selected-file and analyzing states without changing its public `choose` event.
- Modify `backend/README.md`: local setup, model placement, API examples, and license/data attribution.
- Create `backend/docs/pose-api.md`: endpoint and JSONL contract for frontend and future workers.

### Task 1: Lock the pose data contract with failing tests

**Files:**
- Create: `backend/app/pose/schemas.py`
- Create: `backend/tests/test_pose_renderer.py`

- [ ] **Step 1: Write failing tests for 17-point frames and job states**

```python
from app.pose.schemas import FrameResult, JobStatus, PlayerResult


def test_frame_requires_seventeen_keypoints():
    player = PlayerResult(
        player_id=0,
        bbox=[0, 0, 10, 10],
        score=0.9,
        center=[5, 5],
        keypoints=[[1, 2, 0.8]] * 17,
    )
    frame = FrameResult(frame_index=2, timestamp_ms=66, players=[player])
    assert len(frame.players[0].keypoints) == 17


def test_job_status_values_are_explicit():
    assert [item.value for item in JobStatus] == ["queued", "running", "succeeded", "failed"]
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd backend; python -m pytest tests/test_pose_renderer.py -q`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.pose'`.

- [ ] **Step 3: Implement the minimal Pydantic schemas**

Define `JobStatus` as a `str, Enum`; define `PlayerResult` with `bbox` length 4, `center` length 2, `score` in `[0, 1]`, and exactly 17 keypoints shaped `[x, y, confidence]`; define `FrameResult`, `JobSummary`, and `JobRecord` with `model_dump()`-compatible fields. Use `Field(min_length=...)` and a validator for the fixed lengths so malformed model output cannot reach the renderer.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd backend; python -m pytest tests/test_pose_renderer.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add backend/app/pose backend/tests/test_pose_renderer.py
git commit -m "feat: define pose analysis data contract"
```

### Task 2: Implement keypoint filtering and stick-figure rendering

**Files:**
- Modify: `backend/app/pose/renderer.py`
- Modify: `backend/tests/test_pose_renderer.py`

- [ ] **Step 1: Add failing tests for the SoloShuttlePose edge list and thresholding**

```python
import numpy as np
from app.pose.renderer import COCO17_EDGES, filter_keypoints, draw_players


def test_edges_match_solo_shuttle_pose_contract():
    assert COCO17_EDGES == [
        (0, 1), (0, 2), (2, 4), (1, 3), (6, 8), (8, 10),
        (11, 12), (5, 7), (7, 9), (5, 11), (11, 13), (13, 15),
        (6, 12), (12, 14), (14, 16), (5, 6),
    ]


def test_low_confidence_points_are_not_connected():
    points = [[10, 10, 0.95] for _ in range(17)]
    points[5][2] = 0.1
    filtered = filter_keypoints(points, threshold=0.5)
    assert filtered[5] is None


def test_draw_players_changes_frame_pixels():
    frame = np.zeros((120, 160, 3), dtype=np.uint8)
    player = {"player_id": 0, "bbox": [20, 10, 80, 100], "score": 0.9,
              "center": [60, 60], "keypoints": [[60, 30, 0.9]] * 17}
    result = draw_players(frame, [player], threshold=0.5)
    assert np.any(result != frame)
```

- [ ] **Step 2: Run tests and verify the renderer tests fail**

Run: `cd backend; python -m pytest tests/test_pose_renderer.py -q`

Expected: FAIL because renderer functions do not exist.

- [ ] **Step 3: Implement the renderer**

Use the exact `COCO17_EDGES` list above. `filter_keypoints` returns either a float triplet or `None` per point. `draw_players` draws visible edges with `cv2.line`, visible joints with `cv2.circle`, the player center with a larger ring, and a label `P{id} {score:.0%}` above the bounding box. Keep BGR colors explicit and accept `threshold`, `line_width`, and `joint_radius` keyword arguments.

- [ ] **Step 4: Run the focused renderer tests**

Run: `cd backend; python -m pytest tests/test_pose_renderer.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the renderer**

```bash
git add backend/app/pose/renderer.py backend/tests/test_pose_renderer.py
git commit -m "feat: render player stick figures"
```

### Task 3: Add the SoloShuttlePose engine adapter

**Files:**
- Create: `backend/app/pose/engine.py`
- Modify: `backend/app/config.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/tests/test_pose_renderer.py`

- [ ] **Step 1: Write the adapter test with a fake model**

```python
import numpy as np
from app.pose.engine import PoseEngine


class FakeModel:
    def __call__(self, batch):
        return [{"boxes": np.array([[2, 3, 20, 30]]),
                 "scores": np.array([0.9]),
                 "keypoints": np.array([[[5, 6, 0.9]] * 17])}]


def test_engine_normalizes_keypoint_rcnn_output(monkeypatch):
    engine = PoseEngine(model=FakeModel(), device="cpu", detection_threshold=0.5)
    players = engine.detect(np.zeros((40, 40, 3), dtype=np.uint8))
    assert players[0].player_id == 0
    assert players[0].bbox == [2.0, 3.0, 18.0, 27.0]
    assert len(players[0].keypoints) == 17
```

- [ ] **Step 2: Run the adapter test and verify it fails**

Run: `cd backend; python -m pytest tests/test_pose_renderer.py::test_engine_normalizes_keypoint_rcnn_output -q`

Expected: FAIL because `PoseEngine` is missing.

- [ ] **Step 3: Implement `PoseEngine`**

Accept an injected model for tests. In production, load the SoloShuttlePose Keypoint R-CNN checkpoint from `settings.pose_model_path`, select `cuda` when available, and call `.eval()`. Convert model outputs to `PlayerResult`: discard detection scores below the configured threshold, convert `[x1, y1, x2, y2]` to `[x, y, width, height]`, preserve all 17 `[x, y, confidence]` triplets, and compute center from the box. Do not assign cross-frame identity in this adapter.

- [ ] **Step 4: Add configuration and dependency installation notes**

Add `pose_storage_dir`, `pose_model_path`, `pose_detection_threshold`, `pose_max_upload_bytes`, `pose_max_duration_seconds`, and `pose_max_concurrent_jobs` to `Settings`. Add `numpy`, `opencv-python-headless`, `torch`, and `torchvision` to `backend/requirements.txt`, and document CUDA-specific Torch installation separately because the correct wheel depends on the host GPU.

- [ ] **Step 5: Run the adapter and existing backend tests**

Run: `cd backend; python -m pytest tests/test_pose_renderer.py tests/test_api.py -q`

Expected: PASS for the new adapter and all existing gateway tests.

- [ ] **Step 6: Commit the engine adapter**

```bash
git add backend/app/pose/engine.py backend/app/config.py backend/requirements.txt backend/tests/test_pose_renderer.py
git commit -m "feat: adapt SoloShuttlePose pose inference"
```

### Task 4: Build isolated job execution and artifacts

**Files:**
- Create: `backend/app/pose/jobs.py`
- Create: `backend/tests/test_pose_jobs.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing lifecycle tests with a fake engine**

```python
from pathlib import Path
from app.pose.jobs import PoseJobManager


def test_job_runs_to_success_and_writes_artifacts(tmp_path):
    manager = PoseJobManager(storage_dir=tmp_path, engine=FakeVideoEngine())
    record = manager.create(Path("tests/fixtures/one-frame.mp4"), "one-frame.mp4")
    manager.run_sync(record.job_id)
    result = manager.get(record.job_id)
    assert result.status.value == "succeeded"
    assert (tmp_path / record.job_id / "annotated.mp4").exists()
    assert (tmp_path / record.job_id / "frames.jsonl").exists()
    assert (tmp_path / record.job_id / "summary.json").exists()


def test_job_failure_has_stable_error_code(tmp_path):
    manager = PoseJobManager(storage_dir=tmp_path, engine=FailingVideoEngine())
    record = manager.create(Path("tests/fixtures/one-frame.mp4"), "one-frame.mp4")
    manager.run_sync(record.job_id)
    assert manager.get(record.job_id).error.code == "inference_error"
```

- [ ] **Step 2: Add the one-frame fixture or generate it in the test**

Create a tiny MP4 with OpenCV in a pytest fixture so tests do not require a user video or model weights. The fixture must contain one 64x64 BGR frame and a valid MP4V writer result.

- [ ] **Step 3: Run the job tests and verify they fail**

Run: `cd backend; python -m pytest tests/test_pose_jobs.py -q`

Expected: FAIL because `PoseJobManager` is missing.

- [ ] **Step 4: Implement the job manager**

Create a per-job directory using a server-generated UUID. Copy the upload to `input.mp4`, read FPS/frame count with OpenCV, transition `queued -> running`, run engine detection and renderer per frame, write `annotated.mp4` with the input dimensions/FPS, append one `FrameResult.model_dump_json()` per line to `frames.jsonl`, write `summary.json`, then transition to `succeeded`. Convert model, decoder, and filesystem failures to the error codes in the design document. Guard creation with a semaphore and return `busy` when the configured limit is reached.

- [ ] **Step 5: Initialize the manager at app startup**

In `create_app`, construct `PoseJobManager` from settings and store it as `app.state.pose_jobs`. Keep provider registry setup unchanged. Use a daemon thread or `asyncio.to_thread` for HTTP-created jobs; retain `run_sync` for deterministic tests.

- [ ] **Step 6: Run job and gateway tests**

Run: `cd backend; python -m pytest tests/test_pose_jobs.py tests/test_api.py -q`

Expected: PASS.

- [ ] **Step 7: Commit job execution**

```bash
git add backend/app/pose/jobs.py backend/app/main.py backend/tests/test_pose_jobs.py
git commit -m "feat: process pose analysis jobs"
```

### Task 5: Expose authenticated pose API routes

**Files:**
- Modify: `backend/app/api.py`
- Modify: `backend/tests/test_api.py`
- Create: `backend/docs/pose-api.md`

- [ ] **Step 1: Add failing route tests**

```python
def test_pose_create_requires_key(client):
    response = client.post("/api/v1/pose/jobs", files={"file": ("x.mp4", b"bad", "video/mp4")})
    assert response.status_code == 401


def test_pose_status_returns_output_urls(client, monkeypatch):
    monkeypatch.setattr("app.api.validate_pose_upload", lambda *_: None)
    response = client.post(
        "/api/v1/pose/jobs",
        headers={"Authorization": "Bearer test-key"},
        files={"file": ("x.mp4", b"fake", "video/mp4")},
    )
    assert response.status_code == 202
    job_id = response.json()["job_id"]
    status = client.get(f"/api/v1/pose/jobs/{job_id}", headers={"Authorization": "Bearer test-key"})
    assert status.status_code == 200
    assert status.json()["job_id"] == job_id
```

- [ ] **Step 2: Run the route tests and verify they fail**

Run: `cd backend; python -m pytest tests/test_api.py -k pose -q`

Expected: FAIL with `404 Not Found` because the routes are not registered.

- [ ] **Step 3: Implement upload validation and routes**

Add `POST /pose/jobs` with `UploadFile`, protected by `require_api_key`. Validate MIME/name, byte size, and duration when OpenCV can read it; save via `PoseJobManager.create`, start the background task, and return `202` with `job_id`, `status`, and `poll_url`. Add protected `GET /pose/jobs/{job_id}`, `GET /pose/jobs/{job_id}/video`, `GET /pose/jobs/{job_id}/frames`, and `GET /pose/jobs/{job_id}/summary`. Use `FileResponse` for artifacts and return structured `pose_error` payloads for missing jobs and invalid media.

- [ ] **Step 4: Write the API contract document**

Document curl examples, all status values, error codes, JSONL fields, and the required `Authorization: Bearer` header in `backend/docs/pose-api.md`. Include the SoloShuttlePose MIT notice and ShuttleSet citation/data-use note.

- [ ] **Step 5: Run all backend tests**

Run: `cd backend; python -m pytest -q`

Expected: PASS.

- [ ] **Step 6: Commit the API**

```bash
git add backend/app/api.py backend/tests/test_api.py backend/docs/pose-api.md
git commit -m "feat: expose pose analysis API"
```

### Task 6: Connect the UniApp assessment flow

**Files:**
- Create: `utils/pose-analysis.js`
- Modify: `pages/assessment/assessment.vue`
- Modify: `components/VideoUploadCard.vue`

- [ ] **Step 1: Add client tests for validation and polling normalization**

Add a Node test file under `scripts/pose-analysis.test.mjs` using the existing Node runtime. Test that non-MP4, >100 MB, and >60 second inputs return the exact validation messages; test that a succeeded API record maps to `videoUrl`, `framesUrl`, `summary`, and `status: "success"`; test that a failed record preserves its server error message.

- [ ] **Step 2: Run the client tests and verify they fail**

Run: `node --test scripts/pose-analysis.test.mjs`

Expected: FAIL because `utils/pose-analysis.js` is missing.

- [ ] **Step 3: Implement `utils/pose-analysis.js`**

Export `validatePoseVideo`, `createPoseJob`, `pollPoseJob`, and `normalizePoseJob`. Reuse the existing 100 MB/60 second constraints. Use `uni.uploadFile` for creation, `uni.request` for status, exponential polling from 500 ms to 2 s, and reject on `failed`, timeout, or non-2xx responses. Read the backend base URL from the existing cloud utility configuration rather than hardcoding a production URL.

- [ ] **Step 4: Integrate the page state machine**

Extend `assessment.vue` with `uploading`, `processing`, `success`, and `error` states. On success, show the annotated MP4 in a `video` element and a compact result card with frame count, maximum players, and average confidence. Keep the existing local fallback only for an unavailable analysis service, and label it clearly as fallback; do not fabricate a successful pose result from a failed server job.

- [ ] **Step 5: Preserve upload card behavior**

Add `loading`/`disabled` props and a stable status label to `VideoUploadCard.vue`; keep the existing `choose` event so other pages do not break. Ensure button text and error messages fit narrow screens.

- [ ] **Step 6: Run client checks**

Run: `node --test scripts/pose-analysis.test.mjs`; `npm run check`; `npm run format:check`

Expected: PASS.

- [ ] **Step 7: Commit the UniApp integration**

```bash
git add utils/pose-analysis.js scripts/pose-analysis.test.mjs pages/assessment/assessment.vue components/VideoUploadCard.vue
git commit -m "feat: connect pose analysis to assessment page"
```

### Task 7: Documentation, license attribution, and verification

**Files:**
- Modify: `backend/README.md`
- Modify: `README.md`
- Create: `backend/docs/pose-api.md` if not completed in Task 5

- [ ] **Step 1: Document model setup and local execution**

Document the model path, CPU fallback, CUDA Torch installation note, `uvicorn app.main:app --reload --port 8000`, and the exact upload/status curl flow. State that the first version uses existing weights for inference; fine-tuning is a later experiment based on held-out ShuttleSet samples.

- [ ] **Step 2: Add attribution**

Include the SoloShuttlePose GitHub URL, MIT copyright/permission notice, ShuttleSet paper citation, and a statement that raw datasets, weights, and user videos are excluded from Git.

- [ ] **Step 3: Run final verification**

Run: `cd backend; python -m pytest -q`; `cd ..; npm run check`; `npm run format:check`; `git diff --check`.

Expected: all tests and checks pass with no whitespace errors.

- [ ] **Step 4: Commit documentation and verification**

```bash
git add README.md backend/README.md backend/docs/pose-api.md
git commit -m "docs: document pose analysis setup and attribution"
```

## Self-review

- Spec coverage: the plan covers the 17-point contract, exact edge list, engine adapter, isolated job artifacts, API routes, UniApp upload/polling/video rendering, errors, tests, and licensing/data attribution.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step is required; every task names files, commands, expected results, and interfaces.
- Type consistency: `JobStatus`, `PlayerResult`, `FrameResult`, `JobSummary`, and `JobRecord` are introduced in Task 1 and reused by the engine, jobs, and API tasks. Client status values are deliberately normalized separately from server enum values.
- Scope: no ball tracking, human removal, 3D pose, or model fine-tuning is included in this first plan, matching the approved design.

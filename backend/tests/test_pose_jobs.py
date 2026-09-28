from __future__ import annotations

import json
import threading
from pathlib import Path

import cv2
import numpy as np
import pytest

from app.pose.engine import PoseEngineError
from app.pose.jobs import PoseJobError, PoseJobManager


class FakeVideoEngine:
    def detect(self, frame):
        height, width = frame.shape[:2]
        return [
            {
                "player_id": 0,
                "bbox": [8, 8, width - 16, height - 16],
                "score": 0.9,
                "center": [width / 2, height / 2],
                "keypoints": [[width / 2, height / 2, 0.9] for _ in range(17)],
            }
        ]


class FailingVideoEngine:
    def detect(self, frame):
        raise PoseEngineError("inference_error", "fake inference failure")


class BlockingVideoEngine(FakeVideoEngine):
    def __init__(self):
        self.started = threading.Event()
        self.release = threading.Event()

    def detect(self, frame):
        self.started.set()
        self.release.wait(timeout=5)
        return super().detect(frame)


@pytest.fixture()
def one_frame_video(tmp_path: Path) -> Path:
    path = tmp_path / "one-frame.mp4"
    writer = cv2.VideoWriter(
        str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10.0, (64, 64)
    )
    assert writer.isOpened()
    writer.write(np.zeros((64, 64, 3), dtype=np.uint8))
    writer.release()
    assert path.is_file()
    return path


def test_job_runs_to_success_and_writes_artifacts(tmp_path, one_frame_video):
    manager = PoseJobManager(storage_dir=tmp_path / "jobs", engine=FakeVideoEngine())
    record = manager.create(one_frame_video, "one-frame.mp4")

    result = manager.run_sync(record.job_id)

    assert result.status.value == "succeeded"
    job_dir = tmp_path / "jobs" / record.job_id
    assert (job_dir / "annotated.mp4").is_file()
    assert (job_dir / "frames.jsonl").is_file()
    assert (job_dir / "summary.json").is_file()
    assert result.progress == 1.0
    assert result.summary is not None
    assert result.summary.frame_count == 1
    frame = json.loads((job_dir / "frames.jsonl").read_text(encoding="utf-8"))
    assert frame["frame_index"] == 0
    assert len(frame["players"]) == 1


def test_job_failure_has_stable_error_code(tmp_path, one_frame_video):
    manager = PoseJobManager(storage_dir=tmp_path / "jobs", engine=FailingVideoEngine())
    record = manager.create(one_frame_video, "one-frame.mp4")

    result = manager.run_sync(record.job_id)

    assert result.status.value == "failed"
    assert result.error is not None
    assert result.error.code == "inference_error"
    assert not (tmp_path / "jobs" / record.job_id / "annotated.mp4").exists()


def test_model_load_failure_preserves_model_error_code(tmp_path, one_frame_video):
    def unavailable_engine():
        raise PoseEngineError("model_unavailable", "checkpoint is missing")

    manager = PoseJobManager(
        storage_dir=tmp_path / "jobs", engine_factory=unavailable_engine
    )
    record = manager.create(one_frame_video, "one-frame.mp4")

    result = manager.run_sync(record.job_id)

    assert result.status.value == "failed"
    assert result.error is not None
    assert result.error.code == "model_unavailable"


def test_job_is_bounded_and_busy_jobs_remain_queued(tmp_path, one_frame_video):
    engine = BlockingVideoEngine()
    manager = PoseJobManager(
        storage_dir=tmp_path / "jobs", engine=engine, max_concurrent_jobs=1
    )
    first = manager.create(one_frame_video, "first.mp4")
    second = manager.create(one_frame_video, "second.mp4")

    worker = threading.Thread(target=manager.run_sync, args=(first.job_id,))
    worker.start()
    assert engine.started.wait(timeout=2)
    with pytest.raises(PoseJobError) as error:
        manager.run_sync(second.job_id)
    assert error.value.code == "busy"
    assert manager.get(second.job_id).status.value == "queued"
    engine.release.set()
    worker.join(timeout=5)
    assert not worker.is_alive()


def test_start_returns_running_record_and_finishes(tmp_path, one_frame_video):
    manager = PoseJobManager(storage_dir=tmp_path / "jobs", engine=FakeVideoEngine())
    record = manager.create(one_frame_video, "one-frame.mp4")

    running = manager.start(record.job_id)

    assert running.status.value in {"running", "succeeded"}
    for _ in range(50):
        if manager.get(record.job_id).status.value == "succeeded":
            break
        threading.Event().wait(0.01)
    assert manager.get(record.job_id).status.value == "succeeded"

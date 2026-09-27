import pytest
from pydantic import ValidationError

from app.pose.schemas import (
    FrameResult,
    JobRecord,
    JobStatus,
    JobSummary,
    PlayerResult,
)


def make_player(**overrides):
    values = {
        "player_id": 0,
        "bbox": [0, 0, 10, 10],
        "score": 0.9,
        "center": [5, 5],
        "keypoints": [[1, 2, 0.8] for _ in range(17)],
    }
    values.update(overrides)
    return PlayerResult(**values)


def test_frame_requires_seventeen_keypoints():
    player = make_player()
    frame = FrameResult(frame_index=2, timestamp_ms=66, players=[player])

    assert len(frame.players[0].keypoints) == 17


def test_player_rejects_wrong_fixed_vector_lengths():
    with pytest.raises(ValidationError):
        make_player(bbox=[0, 0, 10])

    with pytest.raises(ValidationError):
        make_player(center=[5])


def test_player_rejects_wrong_keypoint_count_or_shape():
    with pytest.raises(ValidationError):
        make_player(keypoints=[[1, 2, 0.8] for _ in range(16)])

    points = [[1, 2, 0.8] for _ in range(17)]
    points[4] = [1, 2]
    with pytest.raises(ValidationError):
        make_player(keypoints=points)


def test_player_confidences_are_bounded():
    with pytest.raises(ValidationError):
        make_player(score=1.1)

    points = [[1, 2, 0.8] for _ in range(17)]
    points[0][2] = -0.1
    with pytest.raises(ValidationError):
        make_player(keypoints=points)


def test_job_status_values_are_explicit():
    assert [item.value for item in JobStatus] == [
        "queued",
        "running",
        "succeeded",
        "failed",
    ]


def test_job_record_serializes_contract_fields():
    record = JobRecord(
        job_id="pose-test",
        status=JobStatus.succeeded,
        progress=1.0,
        input={"filename": "practice.mp4", "duration_ms": 1000, "fps": 30.0},
        outputs={
            "video_url": "/video",
            "frames_url": "/frames",
            "summary_url": "/summary",
        },
        summary=JobSummary(frame_count=30, player_count_max=1, avg_confidence=0.9),
    )

    dumped = record.model_dump(mode="json")
    assert dumped["status"] == "succeeded"
    assert dumped["summary"]["frame_count"] == 30

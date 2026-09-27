import numpy as np
import pytest
from pydantic import ValidationError

from app.pose.schemas import (
    FrameResult,
    JobRecord,
    JobStatus,
    JobSummary,
    PlayerResult,
)
from app.pose.renderer import COCO17_EDGES, draw_players, filter_keypoints
from app.pose.engine import PoseEngine, PoseEngineError
from app.config import Settings


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


def test_player_rejects_non_finite_geometry_and_negative_box_size():
    with pytest.raises(ValidationError):
        make_player(bbox=[0, 0, -1, 10])

    with pytest.raises(ValidationError):
        make_player(center=[float("nan"), 5])

    points = [[1, 2, 0.8] for _ in range(17)]
    points[0][1] = float("inf")
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
    assert filtered[0] == [10.0, 10.0, 0.95]


def test_draw_players_changes_frame_pixels():
    frame = np.zeros((120, 160, 3), dtype=np.uint8)
    player = {
        "player_id": 0,
        "bbox": [20, 10, 80, 100],
        "score": 0.9,
        "center": [60, 60],
        "keypoints": [[60, 30, 0.9]] * 17,
    }

    result = draw_players(frame, [player], threshold=0.5)

    assert np.any(result != frame)


def test_draw_players_omits_edge_when_required_point_is_below_threshold():
    frame = np.zeros((80, 120, 3), dtype=np.uint8)
    points = [[20, 20, 0.1] for _ in range(17)]
    points[0] = [20, 20, 0.9]
    points[1] = [80, 20, 0.9]
    player = {
        "player_id": 0,
        "bbox": [10, 10, 80, 50],
        "score": 0.9,
        "center": [50, 50],
        "keypoints": points,
    }

    with_edge = draw_players(frame, [player], threshold=0.5)
    points[1][2] = 0.1
    without_edge = draw_players(frame, [{**player, "keypoints": points}], threshold=0.5)

    assert tuple(with_edge[20, 50]) != tuple(without_edge[20, 50])


class FakeModel:
    def __call__(self, batch):
        return [
            {
                "boxes": np.array([[2, 3, 20, 30]], dtype=np.float32),
                "scores": np.array([0.9], dtype=np.float32),
                "keypoints": np.array([[[5, 6, 0.9]] * 17], dtype=np.float32),
            }
        ]


def test_engine_normalizes_keypoint_rcnn_output():
    engine = PoseEngine(model=FakeModel(), device="cpu", detection_threshold=0.5)

    players = engine.detect(np.zeros((40, 40, 3), dtype=np.uint8))

    assert players[0].player_id == 0
    assert players[0].bbox == [2.0, 3.0, 18.0, 27.0]
    assert players[0].center == [11.0, 16.5]
    assert len(players[0].keypoints) == 17


def test_engine_discards_detections_below_threshold():
    class LowScoreModel(FakeModel):
        def __call__(self, batch):
            output = super().__call__(batch)[0]
            output["scores"][0] = 0.2
            return [output]

    engine = PoseEngine(model=LowScoreModel(), device="cpu", detection_threshold=0.5)

    assert engine.detect(np.zeros((40, 40, 3), dtype=np.uint8)) == []


def test_engine_reports_missing_production_model(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.pose.engine.get_settings",
        lambda: type("Settings", (), {"pose_model_path": str(tmp_path / "missing.pth")})(),
    )

    with pytest.raises(PoseEngineError) as error:
        PoseEngine(device="cpu")

    assert error.value.code == "model_unavailable"


def test_settings_include_pose_runtime_defaults():
    settings = Settings()

    assert settings.pose_detection_threshold == 0.5
    assert settings.pose_max_upload_bytes == 100 * 1024 * 1024
    assert settings.pose_max_duration_seconds == 60
    assert settings.pose_max_concurrent_jobs >= 1

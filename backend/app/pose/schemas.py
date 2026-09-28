"""Typed contracts shared by pose inference, jobs, and the API."""

from enum import Enum
from math import isfinite

from pydantic import BaseModel, Field, field_validator


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class PlayerResult(BaseModel):
    player_id: int = Field(ge=0)
    bbox: list[float] = Field(min_length=4, max_length=4)
    score: float = Field(ge=0, le=1)
    center: list[float] = Field(min_length=2, max_length=2)
    keypoints: list[list[float]] = Field(min_length=17, max_length=17)

    @field_validator("keypoints")
    @classmethod
    def validate_keypoints(cls, keypoints: list[list[float]]) -> list[list[float]]:
        if any(len(point) != 3 for point in keypoints):
            raise ValueError("each keypoint must contain x, y, and confidence")
        if any(not isfinite(value) for point in keypoints for value in point[:2]):
            raise ValueError("keypoint coordinates must be finite")
        if any(not 0 <= point[2] <= 1 for point in keypoints):
            raise ValueError("keypoint confidence must be between 0 and 1")
        return keypoints

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, bbox: list[float]) -> list[float]:
        if any(not isfinite(value) for value in bbox):
            raise ValueError("bounding box values must be finite")
        if bbox[2] < 0 or bbox[3] < 0:
            raise ValueError("bounding box width and height must be non-negative")
        return bbox

    @field_validator("center")
    @classmethod
    def validate_center(cls, center: list[float]) -> list[float]:
        if any(not isfinite(value) for value in center):
            raise ValueError("center coordinates must be finite")
        return center

    @field_validator("score")
    @classmethod
    def validate_score(cls, score: float) -> float:
        if not isfinite(score):
            raise ValueError("score must be finite")
        return score


class FrameResult(BaseModel):
    frame_index: int = Field(ge=0)
    timestamp_ms: int = Field(ge=0)
    players: list[PlayerResult] = Field(default_factory=list)


class JobInput(BaseModel):
    filename: str = Field(min_length=1)
    duration_ms: int = Field(ge=0)
    fps: float = Field(gt=0)


class JobOutputs(BaseModel):
    video_url: str | None = None
    frames_url: str | None = None
    summary_url: str | None = None


class JobSummary(BaseModel):
    frame_count: int = Field(ge=0)
    player_count_max: int = Field(ge=0)
    avg_confidence: float = Field(ge=0, le=1)


class PoseError(BaseModel):
    code: str
    message: str


class JobRecord(BaseModel):
    job_id: str = Field(min_length=1)
    status: JobStatus
    progress: float = Field(ge=0, le=1)
    input: JobInput
    outputs: JobOutputs = Field(default_factory=JobOutputs)
    summary: JobSummary | None = None
    error: PoseError | None = None

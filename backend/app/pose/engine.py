"""SoloShuttlePose-compatible player pose inference.

The gateway can run without the optional vision stack.  Torch, TorchVision,
NumPy, and OpenCV are imported only when a production model is constructed;
tests and API startup can therefore use the rest of the backend independently.
"""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.pose.schemas import PlayerResult


class PoseEngineError(RuntimeError):
    """A stable error raised while preparing or running the pose model."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _to_python(value: Any) -> Any:
    """Convert tensor/array containers to ordinary Python values lazily."""

    detach = getattr(value, "detach", None)
    if callable(detach):
        value = detach()
    cpu = getattr(value, "cpu", None)
    if callable(cpu):
        value = cpu()
    tolist = getattr(value, "tolist", None)
    if callable(tolist):
        return tolist()
    if isinstance(value, tuple):
        return [_to_python(item) for item in value]
    if isinstance(value, list):
        return [_to_python(item) for item in value]
    return value


def _first(value: Any, index: int, default: Any = None) -> Any:
    values = _to_python(value)
    if not isinstance(values, (list, tuple)) or index >= len(values):
        return default
    return values[index]


class PoseEngine:
    """Run person keypoint inference and normalize it to ``PlayerResult``.

    ``model`` is injectable for tests and for applications that construct the
    SoloShuttlePose model themselves.  Without it, a 17-keypoint TorchVision
    Keypoint R-CNN is created and loaded from ``pose_model_path``.
    """

    def __init__(
        self,
        model: Any | None = None,
        *,
        device: str | None = None,
        detection_threshold: float | None = None,
        model_path: str | Path | None = None,
        settings: Any | None = None,
    ) -> None:
        self._torch: Any | None = None
        self._production_model = model is None
        settings = settings or get_settings()
        configured_threshold = getattr(settings, "pose_detection_threshold", 0.5)
        self.detection_threshold = (
            float(configured_threshold) if detection_threshold is None else float(detection_threshold)
        )
        if not 0 <= self.detection_threshold <= 1:
            raise ValueError("detection_threshold must be between 0 and 1")

        if model is not None:
            self.model = model
            self.device = device or "cpu"
            return

        configured_path = model_path or getattr(settings, "pose_model_path", "")
        self.model, self.device = self._load_model(configured_path, device)

    def _load_model(self, model_path: str | Path, device: str | None) -> tuple[Any, str]:
        path = Path(model_path) if model_path else None
        if path is None or not path.is_file():
            location = str(path) if path else "pose_model_path"
            raise PoseEngineError(
                "model_unavailable",
                f"SoloShuttlePose checkpoint was not found at {location}; configure pose_model_path",
            )

        try:
            torch = importlib.import_module("torch")
            torchvision = importlib.import_module("torchvision")
        except (ImportError, OSError) as exc:
            raise PoseEngineError(
                "model_unavailable",
                "Torch and TorchVision are required for pose inference; install the vision dependencies",
            ) from exc

        selected_device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        try:
            constructor = torchvision.models.detection.keypointrcnn_resnet50_fpn
            try:
                model = constructor(weights=None, weights_backbone=None, num_keypoints=17)
            except TypeError:
                model = constructor(weights=None, num_keypoints=17)
            try:
                checkpoint = torch.load(path, map_location=selected_device, weights_only=False)
            except TypeError:
                checkpoint = torch.load(path, map_location=selected_device)
            if isinstance(checkpoint, torch.nn.Module):
                model = checkpoint
            else:
                state_dict = self._checkpoint_state_dict(checkpoint)
                model.load_state_dict(state_dict, strict=False)
            model.to(selected_device)
            model.eval()
        except Exception as exc:
            raise PoseEngineError(
                "model_unavailable",
                f"Unable to load SoloShuttlePose checkpoint: {exc}",
            ) from exc

        self._torch = torch
        return model, selected_device

    @staticmethod
    def _checkpoint_state_dict(checkpoint: Any) -> dict[str, Any]:
        if not isinstance(checkpoint, dict):
            raise ValueError("checkpoint must contain a state dictionary or a serialized model")
        for key in ("state_dict", "model_state_dict", "model"):
            candidate = checkpoint.get(key)
            if isinstance(candidate, dict):
                checkpoint = candidate
                break
        state_dict = dict(checkpoint)
        if not state_dict:
            raise ValueError("checkpoint state dictionary is empty")
        if all(key.startswith("module.") for key in state_dict):
            state_dict = {key.removeprefix("module."): value for key, value in state_dict.items()}
        return state_dict

    def _prepare_batch(self, frame: Any) -> list[Any]:
        if self._torch is None:
            return [frame]
        tensor = self._torch.as_tensor(frame)
        if tensor.ndim != 3 or tensor.shape[2] != 3:
            raise ValueError("frame must have shape (height, width, 3)")
        tensor = tensor.permute(2, 0, 1).contiguous()
        tensor = tensor[[2, 1, 0]].to(dtype=self._torch.float32) / 255.0
        return [tensor.to(self.device)]

    def detect(self, frame: Any) -> list[PlayerResult]:
        """Detect players in one BGR frame and return normalized results."""

        batch = self._prepare_batch(frame)
        try:
            if self._torch is None:
                output = self.model(batch)
            else:
                with self._torch.inference_mode():
                    output = self.model(batch)
        except PoseEngineError:
            raise
        except Exception as exc:
            raise PoseEngineError("inference_error", f"Pose inference failed: {exc}") from exc

        output = _to_python(output)
        if isinstance(output, (list, tuple)):
            output = output[0] if output else {}
        if not isinstance(output, dict):
            raise PoseEngineError("inference_error", "Pose model returned an invalid result")

        boxes = _to_python(output.get("boxes", []))
        scores = _to_python(output.get("scores", []))
        keypoints = _to_python(output.get("keypoints", []))
        players: list[PlayerResult] = []
        for index, raw_score in enumerate(scores or []):
            score = float(raw_score)
            if score < self.detection_threshold:
                continue
            box = _first(boxes, index)
            points = _first(keypoints, index)
            if not isinstance(box, (list, tuple)) or len(box) != 4:
                raise PoseEngineError("inference_error", "Pose model returned an invalid bounding box")
            if not isinstance(points, (list, tuple)) or len(points) != 17:
                raise PoseEngineError("inference_error", "Pose model returned invalid 17-point keypoints")
            x1, y1, x2, y2 = (float(value) for value in box)
            width, height = x2 - x1, y2 - y1
            normalized_points = [
                [float(point[0]), float(point[1]), float(point[2])] for point in points
            ]
            players.append(
                PlayerResult(
                    player_id=len(players),
                    bbox=[x1, y1, width, height],
                    score=score,
                    center=[x1 + width / 2, y1 + height / 2],
                    keypoints=normalized_points,
                )
            )
        return players


__all__ = ["PoseEngine", "PoseEngineError"]

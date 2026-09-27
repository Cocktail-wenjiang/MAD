"""OpenCV rendering helpers for the 17-point SoloShuttlePose skeleton."""

from collections.abc import Sequence
from typing import Any

import cv2
import numpy as np


# SoloShuttlePose uses the COCO keypoint order (nose, eyes, ears, ... ankles).
COCO17_EDGES: list[tuple[int, int]] = [
    (0, 1),
    (0, 2),
    (2, 4),
    (1, 3),
    (6, 8),
    (8, 10),
    (11, 12),
    (5, 7),
    (7, 9),
    (5, 11),
    (11, 13),
    (13, 15),
    (6, 12),
    (12, 14),
    (14, 16),
    (5, 6),
]


def filter_keypoints(
    keypoints: Sequence[Sequence[float]], threshold: float = 0.5
) -> list[list[float] | None]:
    """Return keypoints whose confidence meets ``threshold``.

    Coordinates are normalized to plain floats so the result can be passed to
    OpenCV or serialized without depending on NumPy scalar types.
    """

    filtered: list[list[float] | None] = []
    for point in keypoints:
        if len(point) < 3:
            filtered.append(None)
            continue
        x, y, confidence = (float(point[0]), float(point[1]), float(point[2]))
        filtered.append([x, y, confidence] if confidence >= threshold else None)
    return filtered


def _value(player: Any, name: str) -> Any:
    if isinstance(player, dict):
        return player[name]
    return getattr(player, name)


def draw_players(
    frame: np.ndarray,
    players: Sequence[Any],
    *,
    threshold: float = 0.5,
    line_width: int = 2,
    joint_radius: int = 4,
) -> np.ndarray:
    """Draw player stick figures and labels over a BGR frame copy.

    ``players`` may contain dictionaries or objects exposing the fields from
    :class:`app.pose.schemas.PlayerResult`. The source frame is left unchanged.
    """

    if frame.ndim != 3 or frame.shape[2] != 3:
        raise ValueError("frame must be a BGR image with shape (height, width, 3)")
    if line_width < 1 or joint_radius < 1:
        raise ValueError("line_width and joint_radius must be positive")

    output = frame.copy()
    skeleton_color = (0, 220, 90)  # BGR green
    joint_color = (0, 245, 255)  # BGR yellow
    center_color = (255, 120, 0)  # BGR blue/orange accent
    label_color = (0, 255, 255)

    for player in players:
        points = filter_keypoints(_value(player, "keypoints"), threshold)
        for first, second in COCO17_EDGES:
            point_a = points[first] if first < len(points) else None
            point_b = points[second] if second < len(points) else None
            if point_a is None or point_b is None:
                continue
            cv2.line(
                output,
                (round(point_a[0]), round(point_a[1])),
                (round(point_b[0]), round(point_b[1])),
                skeleton_color,
                line_width,
                lineType=cv2.LINE_AA,
            )

        for point in points:
            if point is None:
                continue
            cv2.circle(
                output,
                (round(point[0]), round(point[1])),
                joint_radius,
                joint_color,
                thickness=-1,
                lineType=cv2.LINE_AA,
            )

        center = _value(player, "center")
        cv2.circle(
            output,
            (round(float(center[0])), round(float(center[1]))),
            max(joint_radius + 2, 5),
            center_color,
            thickness=line_width,
            lineType=cv2.LINE_AA,
        )

        bbox = _value(player, "bbox")
        x, y, _, _ = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
        player_id = int(_value(player, "player_id"))
        score = float(_value(player, "score"))
        label = f"P{player_id} {score:.0%}"
        label_y = max(15, round(y) - 5)
        cv2.putText(
            output,
            label,
            (round(x), label_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            label_color,
            1,
            lineType=cv2.LINE_AA,
        )

    return output


# Player pose analysis API

The pose API accepts a short MP4, runs the SoloShuttlePose-compatible player
detector in a background worker, and overlays a 2D stick figure on the source
video. The first version identifies players only: it does not draw shuttlecock
tracks, remove the original people, or provide 3D or medical conclusions.

All routes below are available under `/api/v1` (the legacy `/v1` prefix is
also registered). Set `Authorization: Bearer <BACKEND_API_KEY>` on every pose
request.

## Create a job

```bash
curl -X POST http://localhost:8000/api/v1/pose/jobs \
  -H 'Authorization: Bearer dev-key' \
  -F 'file=@practice.mp4;type=video/mp4'
```

The server accepts MP4 files up to `POSE_MAX_UPLOAD_BYTES` (100 MiB by
default) and `POSE_MAX_DURATION_SECONDS` (60 seconds by default). A successful
request returns `202 Accepted`:

```json
{
  "job_id": "pose-...",
  "status": "queued",
  "poll_url": "/api/v1/pose/jobs/pose-..."
}
```

## Poll status

```bash
curl -H 'Authorization: Bearer dev-key' \
  http://localhost:8000/api/v1/pose/jobs/pose-...
```

`status` is one of `queued`, `running`, `succeeded`, or `failed`. A succeeded
record contains download URLs and a summary:

```json
{
  "job_id": "pose-...",
  "status": "succeeded",
  "progress": 1.0,
  "input": {"filename": "practice.mp4", "duration_ms": 32000, "fps": 30.0},
  "outputs": {
    "video_url": "/api/v1/pose/jobs/pose-.../video",
    "frames_url": "/api/v1/pose/jobs/pose-.../frames",
    "summary_url": "/api/v1/pose/jobs/pose-.../summary"
  },
  "summary": {"frame_count": 960, "player_count_max": 2, "avg_confidence": 0.89},
  "error": null
}
```

Download artifacts with the same authorization header:

```bash
curl -L -H 'Authorization: Bearer dev-key' -o annotated.mp4 \
  http://localhost:8000/api/v1/pose/jobs/pose-.../video
curl -L -H 'Authorization: Bearer dev-key' -o frames.jsonl \
  http://localhost:8000/api/v1/pose/jobs/pose-.../frames
curl -L -H 'Authorization: Bearer dev-key' -o summary.json \
  http://localhost:8000/api/v1/pose/jobs/pose-.../summary
```

The frames endpoint is newline-delimited JSON. Each line contains one frame:

```json
{
  "frame_index": 42,
  "timestamp_ms": 1400,
  "players": [{
    "player_id": 0,
    "bbox": [120, 80, 210, 440],
    "score": 0.94,
    "center": [225, 300],
    "keypoints": [[225, 101, 0.98]]
  }]
}
```

The `keypoints` array is abbreviated in the example; every response contains
all 17 COCO points as `[x, y, confidence]` triples.
The `player_id` is stable only within a frame's detection ordering; it is not a
cross-frame identity tracker.

## Errors

Pose validation and job failures use this stable shape:

```json
{"error": {"type": "pose_error", "code": "unsupported_media", "message": "..."}}
```

The main codes are `unsupported_media` (not MP4, too large, or too long),
`decode_error` (video cannot be decoded), `model_unavailable`,
`inference_error`, `storage_error`, `busy`, and `not_found`. Missing artifacts
return `not_found`; a job that exceeds the configured worker concurrency stays
queued and the create request returns `busy`.

## Attribution and data use

The inference adapter follows the [SoloShuttlePose](https://github.com/sunwuzhou03/SoloShuttlePose)
implementation and retains its MIT license and copyright notice. Training and
evaluation may use the legally obtained ShuttleSet/ShuttleSet22 data; cite the
corresponding ShuttleSet paper and comply with its license and usage terms.
Raw videos, model weights, and uploaded user videos are intentionally excluded
from this repository.

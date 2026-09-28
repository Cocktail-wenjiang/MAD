const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_VIDEO_DURATION = 60;

function validateVideo(file) {
  const source = file || {};
  const path = source.tempFilePath || source.path || "";
  const name = source.name || path.split("/").pop() || "";
  const size = Number(source.size || 0);
  const duration = Number(source.duration || 0);

  if (!path) return { ok: false, code: "empty", message: "没有获取到视频文件，请重新选择。" };
  if (!/\.mp4$/i.test(name))
    return { ok: false, code: "format", message: "暂只支持 MP4 格式，请重新选择视频。" };
  if (size > MAX_VIDEO_SIZE)
    return { ok: false, code: "size", message: "视频不能超过 100MB，请压缩后重新上传。" };
  if (duration > MAX_VIDEO_DURATION)
    return { ok: false, code: "duration", message: "视频时长不能超过 60 秒，请重新选择短视频。" };

  return {
    ok: true,
    code: "ok",
    meta: {
      name,
      size,
      duration,
      sizeLabel: `${Math.round((size / 1024 / 1024) * 10) / 10 || "<0.1"}MB`,
      durationLabel: `${Math.round(duration * 10) / 10 || 0}秒`,
    },
  };
}

module.exports = { MAX_VIDEO_SIZE, MAX_VIDEO_DURATION, validateVideo };

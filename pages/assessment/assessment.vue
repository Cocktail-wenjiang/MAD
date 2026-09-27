<template>
  <view class="page">
    <AppTopbar title="自测" />
    <view class="intro">上传高远球或步法短视频，获取能力标签和训练建议。</view>
    <VideoUploadCard
      v-if="status !== 'processing' && status !== 'success'"
      :loading="status === 'uploading'"
      :disabled="status === 'uploading'"
      @choose="chooseVideo"
    />
    <text v-if="error" class="error">{{ error }}</text>
    <view v-if="status === 'uploading'" class="card">
      <text class="title">正在上传 {{ videoName }}</text>
      <text class="detail">视频将发送到姿态分析服务，请稍候</text>
      <view class="progress"><view /></view>
    </view>
    <view v-if="status === 'processing'" class="card">
      <text class="title">正在分析 {{ videoName }}</text>
      <text class="detail">{{ videoMeta }} · 正在提取姿态关键点，请稍候</text>
      <view class="progress">
        <view :style="{ width: `${Math.max(8, Math.round((progress || 0) * 100))}%` }" />
      </view>
    </view>
    <view v-if="status === 'success' && result" class="card result">
      <view class="result-head">
        <text class="title">测评结果</text>
        <text v-if="restored" class="restored">已从本地缓存恢复</text>
      </view>
      <text v-if="!result.poseAnalysis" class="detail">
        {{ videoName }} · 综合水平 {{ result.level }} · 平均 {{ result.scoreAverage }} 分
      </text>
      <text v-else class="detail">{{ videoName }} · 姿态标注完成</text>
      <view v-if="result.poseAnalysis" class="pose-result">
        <video
          class="annotated-video"
          :src="result.poseAnalysis.videoUrl"
          controls
          :show-center-play-btn="true"
        />
        <view class="pose-summary">
          <text>处理帧数：{{ result.poseAnalysis.frameCount }}</text>
          <text>最大球员数：{{ result.poseAnalysis.playerCountMax }}</text>
          <text>平均置信度：{{ result.poseAnalysis.avgConfidenceLabel }}</text>
        </view>
      </view>
      <view class="source">
        <text>结果来源：{{ result.sourceLabel }}</text>
        <text>置信度：{{ result.confidence }}（{{ result.confidenceLabel }}）</text>
      </view>
      <view v-for="item in result.scores" :key="item.name">
        <ScoreBar :label="item.name" :value="item.value" />
        <text class="issue">{{ item.issue }}</text>
        <text class="evidence">依据：{{ item.evidence }}</text>
      </view>
      <TagList :tags="result.tags" />
      <AdviceCard title="训练建议" :text="result.advice" />
      <text class="basis">{{ result.basis }}</text>
      <view class="limits">
        <text class="limit-title">使用边界</text>
        <text v-for="item in result.limitations" :key="item" class="limit">{{ item }}</text>
      </view>
      <text class="disclaimer">测评仅供训练和匹配参考，不作为专业运动诊断。</text>
      <button v-if="!result.confirmed" class="primary" @tap="confirmResult">确认并保存</button>
      <button v-else class="secondary" @tap="retry">再测一次</button>
    </view>
  </view>
</template>
<script setup>
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTopbar from "../../components/AppTopbar.vue";
import VideoUploadCard from "../../components/VideoUploadCard.vue";
import ScoreBar from "../../components/ScoreBar.vue";
import AdviceCard from "../../components/AdviceCard.vue";
import TagList from "../../components/TagList.vue";
import { requireLogin } from "../../utils/auth";
import { loadLastReport, saveProfile, saveReport } from "../../utils/storage";
import { createFallbackAnalysis, decorateReport } from "../../utils/analysis";
import { callCloud } from "../../utils/cloud";
import { createPoseJob, pollPoseJob, validatePoseVideo } from "../../utils/pose-analysis";
const status = ref("idle"),
  videoName = ref(""),
  videoMeta = ref(""),
  result = ref(null),
  error = ref(""),
  restored = ref(false),
  progress = ref(0);
const profileDefault = {
  nickname: "羽球新人",
  region: "武汉",
  availability: "周末晚上",
  level: "待测评",
  tags: ["等待首次测评"],
};
onShow(() => {
  if (!requireLogin()) return;
  if (status.value === "idle" && !result.value) {
    const old = loadLastReport();
    if (old) {
      result.value = decorateReport(old);
      status.value = "success";
      videoName.value = old.video?.name || "";
      restored.value = true;
      progress.value = 1;
    }
  }
});
function chooseVideo() {
  uni.chooseVideo({
    sourceType: ["album", "camera"],
    compressed: false,
    maxDuration: 60,
    camera: "back",
    success: (file) => {
      const v = validatePoseVideo(file);
      if (!v.ok) {
        status.value = "error";
        error.value = v.message;
        return;
      }
      status.value = "uploading";
      error.value = "";
      videoName.value = v.meta.name;
      videoMeta.value = `${v.meta.sizeLabel} · ${v.meta.durationLabel}`;
      result.value = null;
      restored.value = false;
      progress.value = 0;
      runPoseAnalysis(file, v.meta);
    },
    fail: () => {
      status.value = "idle";
    },
  });
}
async function runPoseAnalysis(file, meta) {
  try {
    const created = await createPoseJob(file);
    status.value = "processing";
    const job = await pollPoseJob(created);
    progress.value = 1;
    result.value = decorateReport(createPoseReport(job, meta));
    status.value = "success";
  } catch (reason) {
    if (reason?.fallbackEligible || reason?.code === "service_unavailable") {
      result.value = decorateReport(
        createFallbackAnalysis(meta, "姿态分析服务不可用，已使用本地规则降级")
      );
      status.value = "success";
      return;
    }
    status.value = "error";
    error.value = reason?.message || "姿态分析失败，请稍后重试。";
  }
}
function createPoseReport(job, meta) {
  const summary = job.summary || {};
  const avgConfidence = Number(summary.avg_confidence ?? summary.avgConfidence ?? 0);
  const confidence = Math.max(0, Math.min(1, Number.isFinite(avgConfidence) ? avgConfidence : 0));
  return {
    id: job.jobId,
    source: "pose-service",
    sourceLabel: "SoloShuttlePose 姿态分析",
    video: meta,
    poseAnalysis: {
      videoUrl: job.videoUrl,
      framesUrl: job.framesUrl,
      summaryUrl: job.summaryUrl,
      frameCount: Number(summary.frame_count ?? summary.frameCount ?? 0),
      playerCountMax: Number(summary.player_count_max ?? summary.playerCountMax ?? 0),
      avgConfidence: confidence,
      avgConfidenceLabel: `${Math.round(confidence * 100)}%`,
    },
    scores: [],
    level: "姿态标注完成",
    tags: ["已生成火柴人标注"],
    advice: "可下载标注视频，结合动作轨迹复盘训练。",
    basis: "结果来自 SoloShuttlePose 兼容的单机位 2D 姿态检测，仅叠加火柴人，不显示羽毛球轨迹。",
    confidence,
    quality: confidence < 0.65 ? "低置信度" : "可用",
    limitations: [
      "结果来自单机位 2D 姿态，不代表 3D、生物力学、球速或医疗结论。",
      "火柴人用于训练复盘，关键点缺失时不会补画虚构姿态。",
    ],
    confirmed: false,
    createdAt: new Date().toISOString(),
  };
}
function confirmResult() {
  if (!result.value) return;
  const next = { ...result.value, confirmed: true, confirmedAt: new Date().toISOString() };
  saveReport(next);
  saveProfile({
    ...uni.getStorageSync("badminton_friend_profile"),
    level: next.level,
    tags: next.tags,
  });
  callCloud("saveAssessment", { report: next }).catch(() => {});
  result.value = decorateReport(next);
  uni.showToast({ title: "已保存到我的资料", icon: "success" });
}
function retry() {
  status.value = "idle";
  result.value = null;
  error.value = "";
  restored.value = false;
  progress.value = 0;
}
</script>
<style scoped>
.page {
  padding-bottom: 40rpx;
}
.intro {
  padding: 28rpx 32rpx 20rpx;
  color: #666;
  line-height: 1.6;
}
.card {
  margin: 20rpx 24rpx 0;
  padding: 32rpx;
  border-radius: 14rpx;
  background: #fff;
}
.title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
}
.detail,
.error,
.issue,
.evidence,
.basis,
.disclaimer {
  display: block;
  margin-top: 12rpx;
  color: #777;
  font-size: 23rpx;
  line-height: 1.6;
}
.error {
  margin: 20rpx 32rpx;
  color: #fa5151;
}
.progress {
  height: 12rpx;
  margin-top: 30rpx;
  background: #eee;
}
.progress view {
  height: 100%;
  min-width: 8%;
  background: #07c160;
}
.pose-result {
  margin-top: 20rpx;
}
.annotated-video {
  width: 100%;
  height: 380rpx;
  background: #111;
}
.pose-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx 24rpx;
  margin-top: 16rpx;
  color: #607067;
  font-size: 23rpx;
}
.result-head {
  display: flex;
  justify-content: space-between;
}
.restored {
  color: #07c160;
  font-size: 22rpx;
}
.source {
  margin-top: 16rpx;
  padding: 16rpx;
  color: #607067;
  background: #f5faf7;
  font-size: 23rpx;
  line-height: 1.7;
}
.limits {
  margin-top: 22rpx;
  padding: 20rpx;
  background: #fff9e6;
  border-radius: 8rpx;
}
.limit-title,
.limit {
  display: block;
}
.limit-title {
  color: #806b2b;
  font-weight: 600;
}
.limit {
  margin-top: 8rpx;
  color: #806b2b;
  font-size: 22rpx;
}
.primary,
.secondary {
  margin-top: 26rpx;
  height: 86rpx;
  line-height: 86rpx;
  border-radius: 8rpx;
}
.primary {
  color: #fff;
  background: #07c160;
}
.secondary {
  color: #07c160;
  background: #fff;
  border: 1rpx solid #07c160;
}
</style>

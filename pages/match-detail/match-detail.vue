<template>
  <view class="page">
    <AppTopbar title="活动详情" />

    <!-- 加载中 -->
    <view v-if="loading" class="state-wrap">
      <text class="state-text">加载中...</text>
    </view>

    <!-- 加载失败 -->
    <view v-else-if="!match" class="state-wrap">
      <text class="state-text">{{ errorMsg || "活动不存在" }}</text>
    </view>

    <!-- 活动详情 -->
    <view v-else class="detail">
      <!-- 标题区 -->
      <view class="hero">
        <text class="title">{{ match.title }}</text>
        <view class="hero-meta">
          <text class="level-tag">{{ match.level }}</text>
          <text class="status-tag" :class="match.status">{{ statusText }}</text>
        </view>
      </view>

      <!-- 信息卡片 -->
      <view class="info-card">
        <view class="info-row" @click="openLocation">
          <text class="info-icon">📍</text>
          <view class="info-content">
            <text class="info-label">活动地点</text>
            <text class="info-value">{{ match.place }}</text>
          </view>
          <text class="info-arrow">导航 ›</text>
        </view>

        <view class="info-divider"></view>

        <view class="info-row">
          <text class="info-icon">🕐</text>
          <view class="info-content">
            <text class="info-label">活动时间</text>
            <text class="info-value">{{ match.timeText }} - {{ match.endTimeText }}</text>
          </view>
        </view>

        <view class="info-divider"></view>

        <view class="info-row">
          <text class="info-icon">👥</text>
          <view class="info-content">
            <text class="info-label">报名人数</text>
            <text class="info-value">{{ match.joinedCount }} / {{ match.maxPlayers }}人</text>
          </view>
        </view>

        <view class="info-divider"></view>

        <view class="info-row">
          <text class="info-icon">🏸</text>
          <view class="info-content">
            <text class="info-label">水平要求</text>
            <text class="info-value">{{ match.level }}</text>
          </view>
        </view>
      </view>

      <!-- 发起人 -->
      <view class="section-card">
        <text class="section-title">发起人</text>
        <view class="creator-row">
          <view class="creator-avatar">{{ match.creatorNickname?.charAt(0) || "羽" }}</view>
          <view class="creator-info">
            <text class="creator-name">{{ match.creatorNickname }}</text>
            <text class="creator-label">活动发起者</text>
          </view>
        </view>
      </view>

      <!-- 已报名人员 -->
      <view class="section-card">
        <text class="section-title">已报名 ({{ match.joinedCount }}/{{ match.maxPlayers }})</text>
        <view class="players-grid">
          <view v-for="p in match.players" :key="p.openid" class="player-item">
            <view class="player-avatar">{{ p.nickname?.charAt(0) || "羽" }}</view>
            <text class="player-name">{{ p.nickname }}</text>
            <text class="player-level">{{ p.level }}</text>
          </view>
        </view>
      </view>

      <!-- 补充说明 -->
      <view v-if="match.note" class="section-card">
        <text class="section-title">补充说明</text>
        <text class="note-text">{{ match.note }}</text>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view v-if="match" class="footer">
      <button
        v-if="match.isCreator"
        class="action-btn cancel-btn"
        :disabled="submitting"
        @click="cancelMatch"
      >取消活动</button>
      <button
        v-else-if="match.isJoined"
        class="action-btn leave-btn"
        :disabled="submitting || match.status !== 'active'"
        @click="leaveMatch"
      >{{ submitting ? "操作中..." : "取消报名" }}</button>
      <button
        v-else
        class="action-btn join-btn"
        :disabled="submitting || match.status !== 'active' || match.joinedCount >= match.maxPlayers"
        @click="joinMatch"
      >
        {{ submitting ? "报名中..." : (match.joinedCount >= match.maxPlayers ? "已满员" : "立即报名") }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTopbar from "../../components/AppTopbar.vue";
import { callCloud, isCloudConfigured } from "../../utils/cloud";

const matchId = ref("");
const match = ref(null);
const loading = ref(true);
const errorMsg = ref("");
const submitting = ref(false);

const statusText = computed(() => {
  if (!match.value) return "";
  switch (match.value.status) {
    case "active":
      return "报名中";
    case "cancelled":
      return "已取消";
    case "finished":
      return "已结束";
    default:
      return "";
  }
});

async function fetchDetail() {
  if (!matchId.value) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    if (!isCloudConfigured()) {
      // 模拟数据
      await new Promise((r) => setTimeout(r, 600));
      match.value = getMockDetail();
    } else {
      const res = await callCloud("getMatchDetail", { matchId: matchId.value });
      if (res && res.ok) {
        match.value = res.data;
      } else {
        errorMsg.value = res?.msg || "加载失败";
      }
    }
  } catch (e) {
    console.warn("[活动详情] 加载失败", e);
    errorMsg.value = "加载失败，请重试";
  } finally {
    loading.value = false;
  }
}

function getMockDetail() {
  return {
    _id: "mock1",
    title: "周六晚双打",
    place: "学校体育馆",
    latitude: 39.908823,
    longitude: 116.39747,
    level: "入门至初级",
    status: "active",
    startTime: Date.now() + 86400000,
    endTime: Date.now() + 86400000 + 7200000,
    timeText: "明天 19:00",
    endTimeText: "明天 21:00",
    maxPlayers: 4,
    joinedCount: 2,
    isJoined: false,
    isCreator: false,
    creatorOpenid: "creator123",
    creatorNickname: "羽毛球小王子",
    note: "自带球拍，费用AA，希望水平相近的球友一起打球~",
    players: [
      { openid: "p1", nickname: "羽毛球小王子", level: "初级" },
      { openid: "p2", nickname: "爱打球的小明", level: "入门至初级" },
    ],
  };
}

function openLocation() {
  if (!match.value) return;
  uni.openLocation({
    latitude: match.value.latitude,
    longitude: match.value.longitude,
    name: match.value.place,
    address: match.value.place,
    fail: () => {
      uni.showToast({ title: "无法打开地图", icon: "none" });
    },
  });
}

async function joinMatch() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    if (!isCloudConfigured()) {
      await new Promise((r) => setTimeout(r, 800));
      match.value.isJoined = true;
      match.value.joinedCount += 1;
      uni.showToast({ title: "报名成功", icon: "success" });
      return;
    }
    const res = await callCloud("joinMatch", { matchId: matchId.value });
    if (res && res.ok) {
      match.value.isJoined = true;
      match.value.joinedCount = res.joinedCount;
      uni.showToast({ title: "报名成功", icon: "success" });
      fetchDetail(); // 刷新详情
    } else {
      uni.showToast({ title: res?.msg || "报名失败", icon: "none" });
    }
  } catch (e) {
    console.warn("[报名] 失败", e);
    uni.showToast({ title: "报名失败，请重试", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function leaveMatch() {
  uni.showModal({
    title: "取消报名",
    content: "确定要取消报名吗？",
    success: async (res) => {
      if (!res.confirm) return;
      submitting.value = true;
      try {
        if (!isCloudConfigured()) {
          await new Promise((r) => setTimeout(r, 800));
          match.value.isJoined = false;
          match.value.joinedCount -= 1;
          uni.showToast({ title: "已取消报名", icon: "success" });
          return;
        }
        const result = await callCloud("leaveMatch", { matchId: matchId.value });
        if (result && result.ok) {
          match.value.isJoined = false;
          match.value.joinedCount = result.joinedCount;
          uni.showToast({ title: "已取消报名", icon: "success" });
          fetchDetail();
        } else {
          uni.showToast({ title: result?.msg || "操作失败", icon: "none" });
        }
      } catch (e) {
        console.warn("[取消报名] 失败", e);
        uni.showToast({ title: "操作失败，请重试", icon: "none" });
      } finally {
        submitting.value = false;
      }
    },
  });
}

function cancelMatch() {
  uni.showModal({
    title: "取消活动",
    content: "确定要取消这个约球活动吗？已报名的球友会收到通知。",
    confirmColor: "#e74c3c",
    success: async (res) => {
      if (!res.confirm) return;
      // TODO: 实现取消活动云函数
      uni.showToast({ title: "功能开发中", icon: "none" });
    },
  });
}

onLoad((options) => {
  matchId.value = options?.id || "";
  fetchDetail();
});

onShow(() => {
  if (matchId.value && match.value) {
    fetchDetail();
  }
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7f6;
  padding-bottom: 160rpx;
}

.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 40rpx;
}

.state-text {
  font-size: 28rpx;
  color: #607067;
}

.hero {
  background: linear-gradient(135deg, #0b6e4f, #0a8a5f);
  padding: 40rpx 30rpx;
  color: #fff;
}

.title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1.3;
}

.hero-meta {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.level-tag,
.status-tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.2);
}

.status-tag.active {
  background: rgba(255, 255, 255, 0.9);
  color: #0b6e4f;
}

.status-tag.cancelled,
.status-tag.finished {
  background: rgba(0, 0, 0, 0.2);
}

.info-card {
  margin: -20rpx 24rpx 24rpx;
  background: #fff;
  border-radius: 14rpx;
  padding: 10rpx 24rpx;
  position: relative;
  z-index: 10;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
}

.info-icon {
  font-size: 32rpx;
  margin-right: 20rpx;
}

.info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.info-label {
  font-size: 22rpx;
  color: #8a9a90;
}

.info-value {
  font-size: 28rpx;
  color: #2c3e33;
  font-weight: 500;
}

.info-arrow {
  font-size: 24rpx;
  color: #0b6e4f;
}

.info-divider {
  height: 1rpx;
  background: #eef1ef;
}

.section-card {
  margin: 0 24rpx 24rpx;
  background: #fff;
  border-radius: 14rpx;
  padding: 24rpx;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #2c3e33;
  margin-bottom: 20rpx;
}

.creator-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.creator-avatar,
.player-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #0b6e4f, #0a8a5f);
  color: #fff;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.creator-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.creator-name {
  font-size: 28rpx;
  color: #2c3e33;
  font-weight: 500;
}

.creator-label {
  font-size: 22rpx;
  color: #8a9a90;
}

.players-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.player-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 120rpx;
  gap: 8rpx;
}

.player-avatar {
  width: 72rpx;
  height: 72rpx;
  font-size: 28rpx;
}

.player-name {
  font-size: 22rpx;
  color: #2c3e33;
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-level {
  font-size: 20rpx;
  color: #0b6e4f;
}

.note-text {
  font-size: 26rpx;
  color: #607067;
  line-height: 1.6;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.action-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  border-radius: 44rpx;
  border: none;
}

.action-btn::after {
  border: none;
}

.join-btn {
  color: #fff;
  background: #0b6e4f;
}

.join-btn[disabled] {
  background: #b8c8be;
  color: #fff;
}

.leave-btn {
  color: #e74c3c;
  background: #fff;
  border: 2rpx solid #e74c3c;
}

.leave-btn[disabled] {
  opacity: 0.5;
}

.cancel-btn {
  color: #e74c3c;
  background: #fff;
  border: 2rpx solid #e74c3c;
}
</style>

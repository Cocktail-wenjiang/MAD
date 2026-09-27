<template>
  <view class="page">
    <AppTopbar title="消息" />

    <!-- 加载中 -->
    <view v-if="loading && conversations.length === 0" class="state-wrap">
      <text class="state-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="conversations.length === 0" class="state-wrap">
      <text class="empty-icon">💬</text>
      <text class="state-text">还没有消息</text>
      <text class="state-subtitle">去寻友页找个球友聊聊吧</text>
      <button class="go-btn" @click="goFind">去寻友</button>
    </view>

    <!-- 会话列表 -->
    <view v-else class="session-list">
      <view
        v-for="item in conversations"
        :key="item.conversationId"
        class="session-item"
        @click="openChat(item)"
      >
        <UserAvatar :name="item.peerNickname" :size="96" />
        <view class="session-main">
          <view class="session-top">
            <text class="session-name">{{ item.peerNickname }}</text>
            <text class="session-time">{{ formatTime(item.lastMessageTime) }}</text>
          </view>
          <view class="session-bottom">
            <text class="session-preview">{{ item.lastMessageIsMine ? "我：" : "" }}{{ item.lastMessage }}</text>
            <text v-if="item.unreadCount > 0" class="unread-badge">
              {{ item.unreadCount > 99 ? "99+" : item.unreadCount }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 下拉刷新提示 -->
    <view v-if="!loading && conversations.length > 0" class="pull-tip">
      <text>下拉可刷新</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import { onShow, onHide, onPullDownRefresh } from "@dcloudio/uni-app";
import AppTopbar from "../../components/AppTopbar.vue";
import UserAvatar from "../../components/UserAvatar.vue";
import { requireLogin } from "../../utils/auth";
import { callCloud, isCloudConfigured } from "../../utils/cloud";

const conversations = ref([]);
const loading = ref(false);

let pollTimer = null;
const POLL_INTERVAL = 10000; // 会话列表 10 秒刷新一次

async function fetchConversations() {
  loading.value = true;
  try {
    if (!isCloudConfigured()) {
      // 云服务未配置，显示空状态
      conversations.value = [];
    } else {
      const res = await callCloud("listConversations", {});
      if (res && res.ok) {
        conversations.value = res.data || [];
      }
    }
  } catch (e) {
    console.warn("[会话列表] 加载失败", e);
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const now = new Date();
  const d = new Date(timestamp);
  const diff = now.getTime() - d.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  // 今天
  if (d.toDateString() === now.toDateString()) {
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  // 昨天
  const yesterday = new Date(now.getTime() - oneDay);
  if (d.toDateString() === yesterday.toDateString()) {
    return "昨天";
  }
  // 一周内
  if (diff < 7 * oneDay) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return weekdays[d.getDay()];
  }
  // 更早
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function openChat(item) {
  uni.navigateTo({
    url: `/pages/chat-detail/chat-detail?peerOpenid=${item.peerOpenid}&peerNickname=${encodeURIComponent(item.peerNickname)}`,
  });
}

function goFind() {
  uni.switchTab({ url: "/pages/index/index" });
}

function startPolling() {
  if (!isCloudConfigured()) return;
  stopPolling();
  pollTimer = setInterval(() => {
    // 静默刷新，不显示 loading
    callCloud("listConversations", {})
      .then((res) => {
        if (res && res.ok) {
          conversations.value = res.data || [];
        }
      })
      .catch(() => {});
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onShow(() => {
  if (!requireLogin()) return;
  fetchConversations();
  startPolling();
});

onHide(() => {
  stopPolling();
});

onPullDownRefresh(() => {
  fetchConversations();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7f6;
}

.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.state-text {
  font-size: 28rpx;
  color: #607067;
}

.state-subtitle {
  font-size: 24rpx;
  color: #8a9a90;
  margin-top: 10rpx;
}

.go-btn {
  margin-top: 30rpx;
  padding: 14rpx 40rpx;
  font-size: 26rpx;
  color: #fff;
  background: #0b6e4f;
  border-radius: 40rpx;
  border: none;
  line-height: 1.4;
}

.go-btn::after {
  border: none;
}

.session-list {
  background: #fff;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  border-bottom: 1rpx solid #eef1ef;
}

.session-main {
  flex: 1;
  margin-left: 20rpx;
  min-width: 0;
}

.session-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e33;
}

.session-time {
  font-size: 22rpx;
  color: #8a9a90;
  flex-shrink: 0;
}

.session-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10rpx;
}

.session-preview {
  flex: 1;
  font-size: 24rpx;
  color: #8a9a90;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 16rpx;
}

.unread-badge {
  flex-shrink: 0;
  min-width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  padding: 0 10rpx;
  border-radius: 18rpx;
  background: #fa5151;
  color: #fff;
  font-size: 20rpx;
  text-align: center;
  box-sizing: border-box;
}

.pull-tip {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: #b8c8be;
}
</style>

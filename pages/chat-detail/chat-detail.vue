<template>
  <view class="page">
    <AppTopbar :title="peerNickname" />

    <!-- 消息列表 -->
    <scroll-view
      scroll-y
      class="msg-scroll"
      :scroll-into-view="scrollToId"
      :scroll-with-animation="true"
      @scrolltoupper="loadMore"
    >
      <!-- 加载更多提示 -->
      <view v-if="loadingMore" class="load-more">
        <text>加载中...</text>
      </view>

      <!-- 时间分隔 -->
      <view v-for="(group, gIdx) in messageGroups" :key="gIdx" class="msg-group">
        <view class="time-divider">
          <text class="time-text">{{ formatGroupTime(group.time) }}</text>
        </view>

        <view
          v-for="(msg, mIdx) in group.messages"
          :key="msg._id || mIdx"
          :id="'msg-' + (msg._id || mIdx)"
          :class="['msg-item', msg.mine ? 'mine' : 'other']"
        >
          <template v-if="!msg.mine">
            <UserAvatar :name="peerNickname" :size="72" />
          </template>
          <view class="msg-bubble-wrap">
            <view class="msg-bubble" :class="{ sending: msg.sending, failed: msg.failed }">
              <text class="msg-text">{{ msg.content }}</text>
            </view>
            <text v-if="msg.failed" class="send-fail" @click="resend(msg)">重新发送</text>
          </view>
          <template v-if="msg.mine">
            <UserAvatar name="我" :size="72" />
          </template>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!loading && messages.length === 0" class="empty-tip">
        <text>还没有消息，打个招呼吧 👋</text>
      </view>
    </scroll-view>

    <!-- 底部输入框 -->
    <view class="composer" :style="{ paddingBottom: keyboardHeight + 'px' }">
      <input
        class="composer-input"
        v-model="draft"
        placeholder="说点什么..."
        confirm-type="send"
        :adjust-position="false"
        @confirm="sendMessage"
        @focus="onInputFocus"
        @blur="onInputBlur"
      />
      <button
        class="send-btn"
        :disabled="!draft.trim() || sending"
        @click="sendMessage"
      >发送</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from "vue";
import { onLoad, onShow, onUnload, onHide } from "@dcloudio/uni-app";
import AppTopbar from "../../components/AppTopbar.vue";
import UserAvatar from "../../components/UserAvatar.vue";
import { callCloud, getCloudClient, isCloudConfigured } from "../../utils/cloud";

const peerOpenid = ref("");
const peerNickname = ref("");
const myOpenid = ref("");
const messages = ref([]);
const draft = ref("");
const sending = ref(false);
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(true);
const keyboardHeight = ref(0);
const scrollToId = ref("");

// 实时监听相关
let watcher = null;
let pollTimer = null;
const POLL_INTERVAL = 8000; // 轮询兜底间隔 8 秒
let watchReady = false;

// 生成会话ID
function genConversationId(a, b) {
  return [a, b].sort().join("_");
}

// 按日期分组消息
const messageGroups = computed(() => {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;

  for (const msg of messages.value) {
    const date = new Date(msg.createdAt || Date.now());
    const dateKey = date.toDateString();
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      currentGroup = { time: date.getTime(), messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(msg);
  }
  return groups;
});

function formatGroupTime(timestamp) {
  const now = new Date();
  const d = new Date(timestamp);
  const oneDay = 24 * 60 * 60 * 1000;

  if (d.toDateString() === now.toDateString()) return "今天";
  const yesterday = new Date(now.getTime() - oneDay);
  if (d.toDateString() === yesterday.toDateString()) return "昨天";
  const diff = now.getTime() - d.getTime();
  if (diff < 7 * oneDay) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return weekdays[d.getDay()];
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

async function fetchMessages(isMore = false) {
  if (!peerOpenid.value) return;

  if (isMore) {
    loadingMore.value = true;
  } else {
    loading.value = true;
  }

  try {
    if (!isCloudConfigured()) {
      // 云服务未配置，显示空消息列表
      messages.value = [];
      hasMore.value = false;
    } else {
      const beforeTime = isMore && messages.value.length > 0
        ? messages.value[0].createdAt
        : null;

      const res = await callCloud("listMessages", {
        peerOpenid: peerOpenid.value,
        beforeTime,
        limit: 30,
      });

      if (res && res.ok) {
        const newMsgs = (res.data || []).map((m) => ({
          ...m,
          mine: m.fromOpenid !== peerOpenid.value,
        }));

        if (isMore) {
          messages.value = [...newMsgs, ...messages.value];
        } else {
          messages.value = newMsgs;
        }
        hasMore.value = res.hasMore || false;
      }
    }
  } catch (e) {
    console.warn("[聊天] 加载消息失败", e);
  } finally {
    loading.value = false;
    loadingMore.value = false;
    scrollToBottom();
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value || !isCloudConfigured()) return;
  await fetchMessages(true);
}

async function sendMessage() {
  const text = draft.value.trim();
  if (!text || sending.value) return;

  const tempId = "temp_" + Date.now();
  const tempMsg = {
    _id: tempId,
    content: text,
    mine: true,
    sending: true,
    failed: false,
    createdAt: Date.now(),
  };

  messages.value.push(tempMsg);
  draft.value = "";
  scrollToBottom();
  sending.value = true;

  try {
    if (!isCloudConfigured()) {
      // 云服务未配置，无法发送消息
      const idx = messages.value.findIndex((m) => m._id === tempId);
      if (idx > -1) {
        messages.value[idx].sending = false;
        messages.value[idx].failed = true;
      }
      uni.showToast({ title: "云服务未配置，无法发送消息", icon: "none" });
    } else {
      const res = await callCloud("sendMessage", {
        toOpenid: peerOpenid.value,
        content: text,
        type: "text",
      });

      const idx = messages.value.findIndex((m) => m._id === tempId);
      if (res && res.ok && idx > -1) {
        messages.value[idx] = {
          ...res.message,
          mine: true,
          sending: false,
          failed: false,
        };
      } else if (idx > -1) {
        messages.value[idx].sending = false;
        messages.value[idx].failed = true;
        uni.showToast({ title: res?.msg || "发送失败", icon: "none" });
      }
    }
  } catch (e) {
    console.warn("[聊天] 发送失败", e);
    const idx = messages.value.findIndex((m) => m._id === tempId);
    if (idx > -1) {
      messages.value[idx].sending = false;
      messages.value[idx].failed = true;
    }
    uni.showToast({ title: "发送失败", icon: "none" });
  } finally {
    sending.value = false;
  }
}

function resend(msg) {
  if (!msg || !msg.failed) return;
  // 移除失败的消息，重新发送
  const idx = messages.value.findIndex((m) => m._id === msg._id);
  if (idx > -1) {
    messages.value.splice(idx, 1);
  }
  draft.value = msg.content;
  sendMessage();
}

function scrollToBottom() {
  nextTick(() => {
    if (messages.value.length === 0) return;
    const lastMsg = messages.value[messages.value.length - 1];
    scrollToId.value = "";
    nextTick(() => {
      scrollToId.value = "msg-" + lastMsg._id;
    });
  });
}

function onInputFocus(e) {
  if (e.detail && e.detail.height) {
    keyboardHeight.value = e.detail.height;
  }
  scrollToBottom();
}

function onInputBlur() {
  keyboardHeight.value = 0;
}

// ========== 实时消息监听 ==========

// 增量拉取新消息（兜底用）
async function fetchNewMessages() {
  if (!peerOpenid.value || !isCloudConfigured() || watchReady) return;

  const lastMsg = messages.value[messages.value.length - 1];
  const lastTime = lastMsg?.createdAt || 0;

  try {
    const res = await callCloud("listMessages", {
      peerOpenid: peerOpenid.value,
      limit: 50,
    });

    if (res && res.ok && res.data && res.data.length > 0) {
      const newMsgs = res.data
        .filter((m) => m.createdAt > lastTime && m.fromOpenid === peerOpenid.value)
        .map((m) => ({ ...m, mine: false }));

      if (newMsgs.length > 0) {
        handleIncomingMessages(newMsgs);
      }
    }
  } catch (e) {
    console.warn("[聊天] 增量拉取失败", e);
  }
}

// 处理收到的新消息
function handleIncomingMessages(newMsgs) {
  if (!newMsgs || newMsgs.length === 0) return;

  // 去重
  const existingIds = new Set(messages.value.map((m) => m._id));
  const uniqueMsgs = newMsgs.filter((m) => !existingIds.has(m._id));

  if (uniqueMsgs.length > 0) {
    messages.value.push(...uniqueMsgs);
    // 自动滚动到底部
    scrollToBottom();
    // 震动提示（可选）
    // uni.vibrateShort({ type: "light" });
  }
}

// 启动实时监听（优先 watch，失败降级轮询）
async function startRealtimeListener() {
  if (!isCloudConfigured() || !peerOpenid.value || !myOpenid.value) return;

  const conversationId = genConversationId(myOpenid.value, peerOpenid.value);

  try {
    const cloud = getCloudClient();
    if (!cloud || typeof cloud.database !== "function") {
      startPolling();
      return;
    }
    const db = cloud.database();
    const collection = db.collection("messages");

    // watch 只监听对方发给我的新消息（fromOpenid = peerOpenid, toOpenid = myOpenid）
    // 以及 conversationId 匹配的消息
    watcher = collection
      .where({
        conversationId,
      })
      .orderBy("createdAt", "desc")
      .limit(1)
      .watch({
        onChange: (snapshot) => {
          // 有数据变化
          watchReady = true;
          stopPolling();

          if (snapshot.docChanges && snapshot.docChanges.length > 0) {
            const newMsgs = [];
            for (const change of snapshot.docChanges) {
              if (change.type === "add") {
                const doc = change.doc;
                // 只处理对方发来的消息
                if (doc.fromOpenid === peerOpenid.value) {
                  newMsgs.push({ ...doc, mine: false });
                }
              }
            }
            if (newMsgs.length > 0) {
              // 按时间排序后加入
              newMsgs.sort((a, b) => a.createdAt - b.createdAt);
              handleIncomingMessages(newMsgs);
              // 标记已读
              markMessagesRead(newMsgs);
            }
          }
        },
        onError: (err) => {
          console.warn("[聊天] watch 出错，降级为轮询", err);
          watchReady = false;
          startPolling();
        },
      });

    console.log("[聊天] watch 模式已启动");
  } catch (e) {
    console.warn("[聊天] watch 不可用，使用轮询模式", e);
    watchReady = false;
    startPolling();
  }
}

// 标记消息为已读（通过云函数批量标记）
async function markMessagesRead(msgs) {
  if (!msgs || msgs.length === 0) return;
  // listMessages 云函数已经会自动标记，这里可以再调一次确保
  // 也可以加一个专门的 markRead 云函数
}

// 启动定时轮询（兜底）
function startPolling() {
  if (watchReady) return; // watch 正常就不用轮询
  stopPolling();
  pollTimer = setInterval(() => {
    fetchNewMessages();
  }, POLL_INTERVAL);
}

// 停止轮询
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// 停止实时监听
function stopRealtimeListener() {
  stopPolling();
  watchReady = false;
  if (watcher) {
    try {
      watcher.close();
    } catch (e) {
      console.warn("[聊天] 关闭 watch 出错", e);
    }
    watcher = null;
  }
}

// 获取当前用户信息
async function fetchMyInfo() {
  try {
    const res = await callCloud("getMyInfo", {});
    if (res && res.ok) {
      myOpenid.value = res.openid;
      return res;
    }
  } catch (e) {
    console.warn("[聊天] 获取用户信息失败", e);
  }
  return null;
}

// ========== 生命周期 ==========

onLoad(async (options) => {
  peerOpenid.value = options?.peerOpenid || "";
  peerNickname.value = decodeURIComponent(options?.peerNickname || "");

  // 云服务配置了的话，先获取自己的 openid
  if (isCloudConfigured()) {
    await fetchMyInfo();
  }

  // 加载历史消息
  await fetchMessages();

  // 启动实时监听
  if (isCloudConfigured() && myOpenid.value) {
    startRealtimeListener();
  }
});

onShow(() => {
  // 回到聊天页，检查新消息
  if (peerOpenid.value && messages.value.length > 0) {
    if (!watchReady) {
      fetchNewMessages();
    }
  }
  // 恢复监听
  if (!watcher && isCloudConfigured() && myOpenid.value) {
    startRealtimeListener();
  }
});

onHide(() => {
  stopRealtimeListener();
});

onUnload(() => {
  stopRealtimeListener();
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ededed;
}

.msg-scroll {
  flex: 1;
  padding: 20rpx 0;
  box-sizing: border-box;
}

.load-more {
  text-align: center;
  padding: 20rpx;
  font-size: 24rpx;
  color: #8a9a90;
}

.time-divider {
  display: flex;
  justify-content: center;
  padding: 20rpx 0;
}

.time-text {
  font-size: 22rpx;
  color: #b0b0b0;
  background: #d9d9d9;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.msg-group {
  padding: 0 20rpx;
}

.msg-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 24rpx;
  gap: 16rpx;
}

.msg-item.mine {
  flex-direction: row-reverse;
}

.msg-bubble-wrap {
  max-width: 70%;
  display: flex;
  flex-direction: column;
}

.msg-item.mine .msg-bubble-wrap {
  align-items: flex-end;
}

.msg-bubble {
  padding: 18rpx 22rpx;
  border-radius: 8rpx;
  background: #fff;
  font-size: 28rpx;
  color: #2c3e33;
  line-height: 1.5;
  word-break: break-all;
  position: relative;
}

.msg-item.mine .msg-bubble {
  background: #95ec69;
}

.msg-bubble.sending {
  opacity: 0.6;
}

.msg-bubble.failed {
  background: #ffe0e0;
}

.send-fail {
  font-size: 22rpx;
  color: #fa5151;
  margin-top: 6rpx;
}

.msg-text {
  display: block;
}

.empty-tip {
  text-align: center;
  padding: 100rpx 40rpx;
  font-size: 26rpx;
  color: #8a9a90;
}

.composer {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  background: #f7f7f7;
  border-top: 1rpx solid #e5e5e5;
  transition: padding-bottom 0.2s;
}

.composer-input {
  flex: 1;
  height: 76rpx;
  padding: 0 24rpx;
  background: #fff;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.send-btn {
  width: 120rpx;
  height: 76rpx;
  line-height: 76rpx;
  font-size: 28rpx;
  color: #fff;
  background: #07c160;
  border-radius: 8rpx;
  border: none;
  padding: 0;
  margin: 0;
}

.send-btn::after {
  border: none;
}

.send-btn[disabled] {
  background: #b8dfc8;
  color: #fff;
}
</style>

<template>
  <view v-if="!closed" class="floating-wrap" :style="floatingStyle">
    <view
      v-if="!expanded"
      class="bubble"
      hover-class="bubble-hover"
      @tap="handleBubbleTap"
      @touchstart="startDrag"
      @touchmove.stop.prevent="moveDrag"
      @touchend="endDrag"
    >
      <text class="bubble-spark">✦</text>
      <text class="bubble-label">AI</text>
    </view>
    <view v-else class="panel" :style="panelStyle">
      <view class="panel-head">
        <view class="coach-mark"><text>✦</text></view>
        <view class="head-copy">
          <text class="panel-title">AI 教练</text>
          <text class="panel-status">在线 · 随时给你一个训练建议</text>
        </view>
        <view class="head-actions">
          <text class="action" @tap.stop="hide">隐藏</text>
          <text class="close" @tap.stop="close">×</text>
        </view>
      </view>
      <text class="tip">先做 3 组无球启动和回中，动作放慢一点，感受重心落在前脚掌。</text>
      <view class="panel-actions">
        <button class="ask" @tap.stop="openCoach">
          打开训练台
          <text>→</text>
        </button>
        <button class="dismiss" @tap.stop="hide">稍后再说</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";

const emit = defineEmits(["open"]);
const expanded = ref(false);
const closed = ref(false);
const position = reactive({ left: null, top: null });
const drag = reactive({ active: false, moved: false, offsetX: 0, offsetY: 0 });
let viewport = { width: 375, height: 667 };
let bubbleSize = { width: 56, height: 36 };

try {
  closed.value = uni.getStorageSync("mad_ai_coach_closed") === "1";
} catch (e) {}

const floatingStyle = computed(() =>
  position.left == null
    ? {}
    : { left: `${position.left}px`, top: `${position.top}px`, right: "auto", bottom: "auto" }
);
const panelStyle = computed(() => {
  if (position.left == null) return {};
  const panelWidth = 590 * (viewport.width / 750);
  const shift = Math.max(0, panelWidth - bubbleSize.width + 8 - position.left);
  return { right: `${-shift}px` };
});

onMounted(() => {
  const info = uni.getSystemInfoSync();
  viewport = {
    width: Number(info.windowWidth) || viewport.width,
    height: Number(info.windowHeight) || viewport.height,
  };
  const scale = viewport.width / 750;
  bubbleSize = { width: 112 * scale, height: 72 * scale };
  let saved = null;
  try {
    saved = uni.getStorageSync("mad_ai_coach_position");
  } catch (e) {}
  const left = Number(saved && saved.left);
  const top = Number(saved && saved.top);
  position.left = Number.isFinite(left) ? left : viewport.width - bubbleSize.width - 16;
  position.top = Number.isFinite(top) ? top : viewport.height - bubbleSize.height - 130 * scale;
  clampPosition();
});

function clampPosition() {
  position.left = Math.max(8, Math.min(position.left, viewport.width - bubbleSize.width - 8));
  position.top = Math.max(8, Math.min(position.top, viewport.height - bubbleSize.height - 8));
}
function startDrag(event) {
  const touch = event.touches && event.touches[0];
  if (!touch) return;
  drag.active = true;
  drag.moved = false;
  drag.offsetX = touch.pageX - position.left;
  drag.offsetY = touch.pageY - position.top;
}
function moveDrag(event) {
  if (!drag.active) return;
  const touch = event.touches && event.touches[0];
  if (!touch) return;
  if (
    Math.abs(touch.pageX - (position.left + drag.offsetX)) > 4 ||
    Math.abs(touch.pageY - (position.top + drag.offsetY)) > 4
  )
    drag.moved = true;
  position.left = touch.pageX - drag.offsetX;
  position.top = touch.pageY - drag.offsetY;
  clampPosition();
}
function endDrag() {
  if (!drag.active) return;
  drag.active = false;
  try {
    uni.setStorageSync("mad_ai_coach_position", { left: position.left, top: position.top });
  } catch (e) {}
}
function handleBubbleTap() {
  if (drag.moved) {
    drag.moved = false;
    return;
  }
  expanded.value = true;
}
function hide() {
  expanded.value = false;
}
function close() {
  closed.value = true;
  try {
    uni.setStorageSync("mad_ai_coach_closed", "1");
  } catch (e) {}
}
function openCoach() {
  expanded.value = false;
  emit("open");
}
</script>

<style scoped>
.floating-wrap {
  position: fixed;
  z-index: 20;
  width: 112rpx;
  height: 72rpx;
  right: 24rpx;
  bottom: 130rpx;
}
.bubble {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 72rpx;
  border-radius: 38rpx;
  color: #eafff0;
  background: #12251d;
  box-shadow: 0 12rpx 30rpx rgba(18, 37, 29, 0.24);
  animation: float-in 0.25s ease-out;
}
.bubble-hover {
  opacity: 0.88;
  transform: scale(0.97);
}
.bubble-spark {
  margin-right: 7rpx;
  color: #ffd36b;
  font-size: 28rpx;
}
.bubble-label {
  font-size: 25rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}
.panel {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 590rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  color: #effff4;
  background: #12251d;
  box-sizing: border-box;
  box-shadow: 0 18rpx 42rpx rgba(18, 37, 29, 0.28);
  animation: panel-in 0.2s ease-out;
}
.panel-head {
  display: flex;
  align-items: center;
}
.coach-mark {
  width: 58rpx;
  height: 58rpx;
  margin-right: 14rpx;
  border-radius: 18rpx;
  text-align: center;
  line-height: 58rpx;
  color: #ffd36b;
  background: #28523c;
  font-size: 30rpx;
}
.head-copy {
  flex: 1;
}
.panel-title {
  display: block;
  font-size: 29rpx;
  font-weight: 700;
}
.panel-status {
  display: block;
  margin-top: 5rpx;
  color: #9cc8aa;
  font-size: 20rpx;
}
.head-actions {
  display: flex;
  align-items: center;
}
.action {
  padding: 12rpx;
  color: #a9d8b8;
  font-size: 21rpx;
}
.close {
  padding: 0 0 7rpx 15rpx;
  color: #9cc8aa;
  font-size: 40rpx;
  font-weight: 200;
  line-height: 1;
}
.tip {
  display: block;
  margin-top: 20rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  color: #d3eedb;
  background: rgba(230, 255, 239, 0.08);
  font-size: 23rpx;
  line-height: 1.6;
}
.panel-actions {
  display: flex;
  margin-top: 18rpx;
}
.panel-actions button {
  height: 70rpx;
  line-height: 70rpx;
  border-radius: 10rpx;
  font-size: 23rpx;
}
.ask {
  flex: 1;
  color: #123520;
  background: #a5e7b9;
}
.ask text {
  margin-left: 10rpx;
  font-size: 28rpx;
}
.dismiss {
  width: 170rpx;
  margin-left: 12rpx;
  color: #b3d7be;
  background: transparent;
  border: 1rpx solid rgba(202, 240, 214, 0.28);
}
@keyframes float-in {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(10rpx) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

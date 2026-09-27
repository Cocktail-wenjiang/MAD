<template>
  <view class="card">
    <text class="icon">↑</text>
    <text class="title">{{ title }}</text>
    <text class="hint">{{ hint }}</text>
    <button class="button" :disabled="disabled || loading" :loading="loading" @tap="emitChoose">
      {{ loading ? "正在上传" : buttonLabel }}
    </button>
  </view>
</template>
<script setup>
const props = defineProps({
  title: { type: String, default: "选择练习视频" },
  hint: { type: String, default: "MP4 格式 · 不超过 60 秒" },
  buttonLabel: { type: String, default: "选择视频" },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["choose"]);
function emitChoose() {
  if (props.disabled || props.loading) return;
  emit("choose");
}
</script>
<style scoped>
.card {
  padding: 32rpx;
  border-radius: 14rpx;
  background: #fff;
  text-align: center;
}
.icon {
  display: block;
  margin: 0 auto 16rpx;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  line-height: 76rpx;
  color: #07c160;
  background: #e9f8ef;
  font-size: 44rpx;
}
.title,
.hint {
  display: block;
}
.hint {
  margin-top: 10rpx;
  color: #888;
  font-size: 23rpx;
}
.button {
  margin-top: 24rpx;
  color: #fff;
  background: #07c160;
}
</style>

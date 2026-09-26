<template>
  <view class="ai-card" @tap="open">
    <view class="glow glow-one" />
    <view class="glow glow-two" />
    <view class="card-head">
      <view class="eyebrow"><text class="spark">✦</text><text>AI 训练台</text></view>
      <text class="arrow">↗</text>
    </view>
    <text class="title">今天也让动作更聪明</text>
    <text class="description">上传一段练习视频，AI 会帮你找到下一个最值得练的动作。</text>
    <view class="card-foot"><text>开始一次智能测评</text><text class="foot-arrow">→</text></view>
  </view>
</template>

<script setup>
const emit = defineEmits(['open'])
function open() { emit('open') }
</script>

<style scoped>
.ai-card{position:relative;overflow:hidden;margin:8rpx 24rpx 28rpx;padding:30rpx;border-radius:22rpx;color:#f6fff9;background:#12251d;box-shadow:0 14rpx 32rpx rgba(18,37,29,.16)}
.glow{position:absolute;border-radius:50%;pointer-events:none;filter:blur(3rpx)}
.glow-one{width:210rpx;height:210rpx;right:-62rpx;top:-82rpx;background:rgba(77,205,135,.26)}
.glow-two{width:150rpx;height:150rpx;right:120rpx;bottom:-110rpx;background:rgba(255,197,90,.16)}
.card-head,.card-foot{position:relative;display:flex;align-items:center;justify-content:space-between}
.eyebrow{display:flex;align-items:center;color:#9be5b8;font-size:23rpx;letter-spacing:2rpx}.spark{margin-right:9rpx;color:#ffd36b;font-size:28rpx}.arrow{color:#b6d8c2;font-size:34rpx}
.title{position:relative;display:block;margin-top:30rpx;font-size:42rpx;font-weight:700;letter-spacing:1rpx}.description{position:relative;display:block;max-width:580rpx;margin-top:14rpx;color:#b6cfc0;font-size:24rpx;line-height:1.6}
.card-foot{margin-top:30rpx;padding-top:20rpx;border-top:1rpx solid rgba(201,240,215,.18);color:#e8fff0;font-size:24rpx}.foot-arrow{font-size:32rpx;color:#9be5b8}
</style>

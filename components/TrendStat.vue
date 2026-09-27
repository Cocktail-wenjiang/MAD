<template>
  <view class="stats">
    <view>
      <text class="number">{{ stats.count }}</text>
      <text class="label">测评次数</text>
    </view>
    <view>
      <text class="number">{{ stats.average }}</text>
      <text class="label">平均分</text>
    </view>
    <view>
      <text class="number">{{ stats.latest }}</text>
      <text class="label">最近得分</text>
    </view>
  </view>
</template>
<script setup>
defineProps({ stats: { type: Object, default: () => ({}) } });
</script>
<style scoped>
.stats {
  display: flex;
  margin: 24rpx;
  padding: 28rpx 10rpx;
  border-radius: 14rpx;
  background: #fff;
}
.stats > view {
  flex: 1;
  text-align: center;
  border-right: 1rpx solid #eee;
}
.stats > view:last-child {
  border-right: 0;
}
.number,
.label {
  display: block;
}
.number {
  color: #07c160;
  font-size: 38rpx;
  font-weight: 700;
}
.label {
  margin-top: 8rpx;
  color: #888;
  font-size: 22rpx;
}
</style>

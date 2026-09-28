<template>
  <view class="row">
    <view class="head">
      <text>{{ label }}</text>
      <text>{{ value }}分</text>
    </view>
    <view class="bar"><view :style="{ width: value + '%' }"></view></view>
  </view>
</template>
<script setup>
defineProps({ label: String, value: { type: Number, default: 0 } });
</script>
<style scoped>
.row {
  margin-top: 18rpx;
}
.head {
  display: flex;
  justify-content: space-between;
  color: #555;
  font-size: 24rpx;
}
.head text:last-child {
  color: #07c160;
}
.bar {
  margin-top: 8rpx;
  height: 10rpx;
  border-radius: 8rpx;
  background: #eee;
  overflow: hidden;
}
.bar view {
  height: 100%;
  border-radius: 8rpx;
  background: #07c160;
}
</style>

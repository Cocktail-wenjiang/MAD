<template>
  <view class="card">
    <view class="card-header">
      <text class="title">{{ activity.title }}</text>
      <text v-if="activity.distanceText" class="distance">{{ activity.distanceText }}</text>
    </view>
    <text class="detail">{{ activity.place }} · {{ activity.timeText || activity.time }}</text>
    <view class="card-footer">
      <text class="level">适合：{{ activity.level }}</text>
      <text v-if="activity.joinedCount !== undefined" class="players">
        {{ activity.joinedCount }}/{{ activity.maxPlayers || 4 }}人
      </text>
    </view>
  </view>
</template>
<script setup>
defineProps({ activity: { type: Object, default: () => ({}) } });
</script>
<style scoped>
.card {
  margin-bottom: 18rpx;
  padding: 26rpx;
  border-radius: 14rpx;
  background: #fff;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title {
  font-size: 31rpx;
  font-weight: 600;
}
.distance {
  font-size: 24rpx;
  color: #0b6e4f;
  font-weight: 500;
}
.detail {
  display: block;
  margin-top: 12rpx;
  color: #607067;
  font-size: 24rpx;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
}
.level {
  color: #0b6e4f;
  font-size: 24rpx;
}
.players {
  color: #8a9a90;
  font-size: 24rpx;
}
</style>

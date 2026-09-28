<template>
  <view class="card">
    <view class="card-header">
      <text class="title text-ellipsis">{{ activity.title }}</text>
      <text v-if="activity.distanceText" class="distance">{{ activity.distanceText }}</text>
    </view>
    <text class="detail text-ellipsis">{{ activity.place }} · {{ activity.timeText || activity.time }}</text>
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
  padding: 28rpx;
  border-radius: 16rpx;
  background: #fff;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.03);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: #2c3e33;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.distance {
  flex-shrink: 0;
  font-size: 26rpx;
  color: #0b6e4f;
  font-weight: 600;
}

.detail {
  display: block;
  color: #607067;
  font-size: 26rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 16rpx;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1rpx solid #eef1ef;
}

.level {
  color: #0b6e4f;
  font-size: 24rpx;
  font-weight: 500;
}

.players {
  color: #8a9a90;
  font-size: 24rpx;
}
</style>

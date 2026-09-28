<template>
  <view class="app-topbar">
    <view class="nav-bar">
      <view class="nav-left" @tap="$emit('back')" v-if="showBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="title">{{ title }}</text>
      <view class="nav-right">
        <text v-if="action" class="action" @tap="$emit('action')">{{ action }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: "" },
  action: { type: String, default: "" },
  showBack: { type: Boolean, default: false },
});
defineEmits(["action", "back"]);
</script>

<style scoped>
.app-topbar {
  background: #fff;
  border-bottom: 1rpx solid #eef1ef;
}

.nav-bar {
  height: 88rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-left,
.nav-right {
  width: 80rpx;
  display: flex;
  align-items: center;
}

.nav-right {
  justify-content: flex-end;
}

.back-icon {
  font-size: 48rpx;
  color: #2c3e33;
  font-weight: 300;
  line-height: 1;
}

.title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: #2c3e33;
}

.action {
  color: #0b6e4f;
  font-size: 28rpx;
  font-weight: 500;
}
</style>

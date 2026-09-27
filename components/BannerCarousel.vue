<template>
  <swiper v-if="banners.length" class="swiper" indicator-dots autoplay circular>
    <swiper-item v-for="item in banners" :key="item.id">
      <view class="banner">
        <text class="title">{{ item.title }}</text>
        <text class="desc">{{ item.description }}</text>
      </view>
    </swiper-item>
  </swiper>
</template>
<script setup>
defineProps({ banners: { type: Array, default: () => [] } });
</script>
<style scoped>
.swiper {
  height: 170rpx;
  margin: 0 24rpx;
}
.banner {
  height: 100%;
  box-sizing: border-box;
  padding: 28rpx;
  border-radius: 16rpx;
  color: #fff;
  background: linear-gradient(135deg, #18b968, #067a44);
}
.title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
}
.desc {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  opacity: 0.9;
}
</style>

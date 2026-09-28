<template>
  <view
    class="avatar"
    :style="{
      width: size + 'rpx',
      height: size + 'rpx',
      lineHeight: size + 'rpx',
      fontSize: size / 2.4 + 'rpx',
    }"
  >
    <image v-if="src" class="avatar-img" :src="src" mode="aspectFill" />
    <text v-else class="avatar-text">{{ (name || "友").slice(0, 1) }}</text>
  </view>
</template>

<script setup>
defineProps({
  name: { type: String, default: "友" },
  size: { type: Number, default: 76 },
  src: { type: String, default: "" },
});
</script>

<style scoped>
.avatar {
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #0b6e4f, #0a8a5f);
  text-align: center;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-text {
  display: block;
  font-weight: 600;
}
</style>

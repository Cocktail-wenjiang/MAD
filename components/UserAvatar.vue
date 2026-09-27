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
    {{ (name || "友").slice(0, 1) }}
  </view>
</template>
<script setup>
defineProps({ name: { type: String, default: "友" }, size: { type: Number, default: 76 } });
</script>
<style scoped>
.avatar {
  border-radius: 50%;
  color: #fff;
  background: #07c160;
  text-align: center;
}
</style>

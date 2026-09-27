<template>
  <view class="card" @tap="$emit('open', friend)">
    <UserAvatar :name="friend.nickname" />
    <view class="main">
      <view class="head">
        <text>{{ friend.nickname }}</text>
        <LevelBadge :text="friend.level" />
      </view>
      <text class="meta">{{ friend.region }} · {{ friend.availability }}</text>
      <TagList :tags="friend.tags" />
    </view>
    <view class="chat-btn" @tap.stop="$emit('chat', friend)">
      <text class="chat-icon">💬</text>
      <text class="chat-text">聊天</text>
    </view>
  </view>
</template>
<script setup>
import UserAvatar from "./UserAvatar.vue";
import LevelBadge from "./LevelBadge.vue";
import TagList from "./TagList.vue";
defineProps({ friend: { type: Object, default: () => ({}) } });
defineEmits(["open", "chat"]);
</script>
<style scoped>
.card {
  display: flex;
  align-items: flex-start;
  margin-bottom: 2rpx;
  padding: 24rpx 20rpx;
  background: #fff;
}
.main {
  flex: 1;
  margin-left: 20rpx;
}
.head {
  display: flex;
  align-items: center;
  gap: 14rpx;
  font-size: 30rpx;
  font-weight: 600;
}
.meta {
  display: block;
  margin-top: 8rpx;
  color: #888;
  font-size: 24rpx;
}
.chat-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10rpx 16rpx;
  background: #f0f8f4;
  border-radius: 12rpx;
  gap: 4rpx;
}
.chat-icon {
  font-size: 28rpx;
}
.chat-text {
  font-size: 20rpx;
  color: #0b6e4f;
}
</style>

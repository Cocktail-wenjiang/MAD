<template>
  <view class="card" @tap="$emit('open', friend)">
    <UserAvatar :name="friend.nickname" :src="friend.avatar" />
    <view class="main">
      <view class="head">
        <text class="nickname text-ellipsis">{{ friend.nickname }}</text>
        <LevelBadge :text="friend.level" />
      </view>
      <text class="meta text-ellipsis">{{ friend.region }} · {{ friend.availability }}</text>
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
  padding: 28rpx 24rpx;
  background: #fff;
  gap: 20rpx;
}

.main {
  flex: 1;
  min-width: 0;
}

.head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.nickname {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e33;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: block;
  color: #607067;
  font-size: 24rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.chat-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12rpx 18rpx;
  background: #e6f4ee;
  border-radius: 12rpx;
  gap: 4rpx;
  flex-shrink: 0;
}

.chat-icon {
  font-size: 28rpx;
}

.chat-text {
  font-size: 20rpx;
  color: #0b6e4f;
  font-weight: 500;
}
</style>

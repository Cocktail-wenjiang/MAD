<template>
  <view class="page">
    <!-- 地图 -->
    <map
      class="map"
      :latitude="latitude"
      :longitude="longitude"
      :scale="scale"
      :markers="markers"
      :show-location="true"
      :enable-3D="false"
      :show-compass="false"
      :enable-zoom="true"
      :enable-scroll="true"
      :enable-rotate="false"
      :enable-satellite="false"
      :enable-traffic="false"
      :enable-overlooking="false"
      @markertap="onMarkerTap"
      @regionchange="onRegionChange"
    >
    </map>

    <!-- 顶部返回栏 -->
    <view class="top-bar">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="search-info">
        <text class="search-count">{{ friends.length }} 位附近球友</text>
      </view>
      <view class="locate-btn" @click="moveToMyLocation">
        <text class="locate-icon">📍</text>
      </view>
    </view>

    <!-- 半径筛选 -->
    <view class="radius-bar">
      <view
        v-for="r in radiusOptions"
        :key="r"
        class="radius-item"
        :class="{ active: radius === r }"
        @click="changeRadius(r)"
      >
        <text>{{ r }}km</text>
      </view>
    </view>

    <!-- 底部球友卡片滑动 -->
    <view class="bottom-sheet" v-if="friends.length > 0">
      <view class="sheet-handle"></view>
      <scroll-view scroll-x class="card-scroll" :scroll-with-animation="true">
        <view class="card-track">
          <view
            v-for="(item, index) in friends"
            :key="item._id"
            class="mini-card"
            :class="{ active: activeIndex === index }"
            @click="selectMarker(index)"
          >
            <view class="mini-header">
              <image class="mini-avatar" :src="item.avatar || '/static/avatar-default.png'" mode="aspectFill" />
              <view class="mini-info">
                <text class="mini-name">{{ item.nickname || '球友' }}</text>
                <view class="mini-tags">
                  <text class="mini-level">{{ item.level || '未知水平' }}</text>
                  <text class="mini-distance">{{ item.distanceText }}</text>
                </view>
              </view>
            </view>
            <text class="mini-bio" v-if="item.bio">{{ item.bio }}</text>
            <view class="mini-actions">
              <view class="mini-chat-btn" @click.stop="startChat(item)">
                <text>💬 聊天</text>
              </view>
              <view class="mini-detail-btn" @click.stop="viewProfile(item)">
                <text>查看主页 ›</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 空状态 -->
    <view v-if="friends.length === 0 && !loading" class="empty-tip">
      <text>附近还没有球友，分享给朋友一起玩吧~</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { callCloud, isCloudConfigured } from "../../utils/cloud";

const latitude = ref(39.908823);
const longitude = ref(116.39747);
const scale = ref(14);
const friends = ref([]);
const loading = ref(false);
const activeIndex = ref(0);
const radius = ref(10);
const radiusOptions = [3, 5, 10, 20, 50];

const markers = computed(() => {
  return friends.value.map((item, index) => ({
    id: index,
    latitude: item.latitude,
    longitude: item.longitude,
    width: 44,
    height: 44,
    callout: {
      content: item.nickname || '球友',
      color: "#2c3e33",
      fontSize: 12,
      borderRadius: 8,
      bgColor: "#ffffff",
      padding: 6,
      display: activeIndex.value === index ? "ALWAYS" : "BYCLICK",
      textAlign: "center",
    },
    label: {
      content: "🏸",
      fontSize: 18,
      anchorX: -12,
      anchorY: -12,
    },
  }));
});

function getLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      success: (res) => {
        resolve({ latitude: res.latitude, longitude: res.longitude });
      },
      fail: (err) => {
        console.warn("[定位] gcj02 失败，尝试 wgs84", err?.errMsg || err);
        uni.getLocation({
          type: "wgs84",
          isHighAccuracy: false,
          success: (res) => {
            resolve({ latitude: res.latitude, longitude: res.longitude });
          },
          fail: (err2) => {
            reject(err2 || err);
          },
        });
      },
    });
  });
}

async function fetchNearbyFriends() {
  loading.value = true;
  try {
    if (!isCloudConfigured()) {
      await new Promise((r) => setTimeout(r, 600));
      friends.value = getMockFriends(latitude.value, longitude.value, radius.value);
      return;
    }
    const res = await callCloud("listNearbyFriends", {
      latitude: latitude.value,
      longitude: longitude.value,
      radius: radius.value,
    });
    if (res && res.ok) {
      friends.value = res.data || [];
    }
  } catch (e) {
    console.warn("[地图] 查询附近球友失败", e);
  } finally {
    loading.value = false;
  }
}

function getMockFriends(lat, lon, r) {
  const mock = [
    {
      _id: "mock1",
      nickname: "羽毛球小王子",
      avatar: "",
      level: "初级",
      bio: "每周打2-3次，欢迎约球~",
      latitude: lat + 0.006,
      longitude: lon + 0.008,
    },
    {
      _id: "mock2",
      nickname: "爱打球的猫",
      avatar: "",
      level: "入门至初级",
      bio: "新手一枚，求带飞",
      latitude: lat + 0.012,
      longitude: lon - 0.01,
    },
    {
      _id: "mock3",
      nickname: "羽球老司机",
      avatar: "",
      level: "中级",
      bio: "打了5年，主打双打",
      latitude: lat - 0.015,
      longitude: lon + 0.02,
    },
    {
      _id: "mock4",
      nickname: "夜跑选手",
      avatar: "",
      level: "初级至中级",
      bio: "工作日晚上有空",
      latitude: lat + 0.025,
      longitude: lon + 0.015,
    },
  ];
  const R = 6371;
  return mock
    .map((item) => {
      const dLat = ((item.latitude - lat) * Math.PI) / 180;
      const dLon = ((item.longitude - lon) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((item.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return {
        ...item,
        distance,
        distanceText: distance < 1 ? Math.round(distance * 1000) + "m" : distance.toFixed(1) + "km",
      };
    })
    .filter((item) => item.distance <= r)
    .sort((a, b) => a.distance - b.distance);
}

function changeRadius(r) {
  radius.value = r;
  fetchNearbyFriends();
}

function onMarkerTap(e) {
  const index = e.markerId;
  activeIndex.value = index;
}

function selectMarker(index) {
  activeIndex.value = index;
  const item = friends.value[index];
  if (item) {
    latitude.value = item.latitude;
    longitude.value = item.longitude;
  }
}

function viewProfile(item) {
  uni.showModal({
    title: item.nickname || '球友',
    content: `水平：${item.level || '未知'}\n距离：${item.distanceText}\n${item.bio || ''}`,
    showCancel: false,
    confirmText: '好的',
  });
}

function startChat(item) {
  uni.navigateTo({
    url: "/pages/chat-detail/chat-detail?userId=" + item._id + "&nickname=" + encodeURIComponent(item.nickname || '球友') + "&avatar=" + encodeURIComponent(item.avatar || ''),
  });
}

function onRegionChange(e) {
  // 视野变化时可选重新加载
}

function moveToMyLocation() {
  getLocation()
    .then((loc) => {
      latitude.value = loc.latitude;
      longitude.value = loc.longitude;
      scale.value = 15;
    })
    .catch(() => {
      uni.showToast({ title: "定位失败", icon: "none" });
    });
}

function goBack() {
  uni.navigateBack();
}

onLoad(async (options) => {
  if (options?.lat && options?.lon) {
    latitude.value = Number(options.lat);
    longitude.value = Number(options.lon);
  }
  if (options?.radius) {
    radius.value = Number(options.radius);
  }
  try {
    const loc = await getLocation();
    latitude.value = loc.latitude;
    longitude.value = loc.longitude;
    fetchNearbyFriends();
  } catch (e) {
    console.warn("[地图] 定位失败", e);
    uni.showToast({ title: "请开启定位权限", icon: "none" });
  }
});
</script>

<style scoped>
.page {
  width: 100%;
  height: 100vh;
  position: relative;
}

.map {
  width: 100%;
  height: 100%;
}

.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(60rpx + env(safe-area-inset-top)) 24rpx 20rpx;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), transparent);
  z-index: 10;
}

.back-btn,
.locate-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
}

.back-icon {
  font-size: 40rpx;
  color: #2c3e33;
  font-weight: 300;
  line-height: 1;
}

.locate-icon {
  font-size: 28rpx;
}

.search-info {
  background: rgba(255, 255, 255, 0.95);
  padding: 12rpx 24rpx;
  border-radius: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
}

.search-count {
  font-size: 24rpx;
  color: #2c3e33;
  font-weight: 500;
}

.radius-bar {
  position: absolute;
  top: calc(150rpx + env(safe-area-inset-top));
  left: 24rpx;
  right: 24rpx;
  display: flex;
  gap: 16rpx;
  background: rgba(255, 255, 255, 0.95);
  padding: 16rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.radius-item {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #607067;
  transition: all 0.2s;
}

.radius-item.active {
  background: #0b6e4f;
  color: #fff;
  font-weight: 500;
}

.bottom-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 10;
}

.sheet-handle {
  width: 60rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background: rgba(255, 255, 255, 0.8);
  margin: 0 auto 16rpx;
}

.card-scroll {
  white-space: nowrap;
  padding: 0 24rpx;
}

.card-track {
  display: inline-flex;
  gap: 20rpx;
}

.mini-card {
  width: 540rpx;
  flex-shrink: 0;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
}

.mini-card.active {
  transform: scale(1.02);
}

.mini-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
}

.mini-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #eef1ef;
  flex-shrink: 0;
}

.mini-info {
  flex: 1;
  min-width: 0;
}

.mini-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e33;
  margin-bottom: 8rpx;
}

.mini-tags {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.mini-level {
  font-size: 22rpx;
  color: #0b6e4f;
  background: #e6f4ee;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.mini-distance {
  font-size: 22rpx;
  color: #8a9a90;
}

.mini-bio {
  display: block;
  font-size: 24rpx;
  color: #607067;
  line-height: 1.5;
  margin-bottom: 20rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-actions {
  display: flex;
  gap: 16rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eef1ef;
}

.mini-chat-btn {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  background: #0b6e4f;
  color: #fff;
  border-radius: 12rpx;
  font-size: 26rpx;
  font-weight: 500;
}

.mini-detail-btn {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  background: #f3f6f4;
  color: #2c3e33;
  border-radius: 12rpx;
  font-size: 26rpx;
}

.empty-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 28rpx;
  color: #607067;
  background: rgba(255, 255, 255, 0.9);
  padding: 24rpx 40rpx;
  border-radius: 12rpx;
  text-align: center;
}
</style>

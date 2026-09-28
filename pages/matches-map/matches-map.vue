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
        <text class="search-count">{{ matches.length }} 个附近活动</text>
      </view>
      <view class="locate-btn" @click="moveToMyLocation">
        <text class="locate-icon">📍</text>
      </view>
    </view>

    <!-- 底部活动卡片滑动 -->
    <view class="bottom-sheet" v-if="matches.length > 0">
      <view class="sheet-handle"></view>
      <scroll-view scroll-x class="card-scroll" :scroll-with-animation="true">
        <view class="card-track">
          <view
            v-for="(item, index) in matches"
            :key="item._id"
            class="mini-card"
            :class="{ active: activeIndex === index }"
            @click="selectMarker(index)"
          >
            <text class="mini-title">{{ item.title }}</text>
            <text class="mini-place">{{ item.place }}</text>
            <view class="mini-meta">
              <text class="mini-time">{{ item.timeText }}</text>
              <text class="mini-distance">{{ item.distanceText }}</text>
            </view>
            <view class="mini-footer">
              <text class="mini-level">{{ item.level }}</text>
              <text class="mini-players">{{ item.joinedCount }}/{{ item.maxPlayers }}人</text>
            </view>
            <text class="mini-detail">查看详情 ›</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 空状态 -->
    <view v-if="matches.length === 0 && !loading" class="empty-tip">
      <text>附近没有找到约球活动</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { callCloud, isCloudConfigured } from "../../utils/cloud";

const latitude = ref(39.908823);
const longitude = ref(116.39747);
const scale = ref(14);
const matches = ref([]);
const loading = ref(false);
const activeIndex = ref(0);
const radius = ref(10);

const markers = computed(() => {
  return matches.value.map((item, index) => ({
    id: index,
    latitude: item.latitude,
    longitude: item.longitude,
    iconPath: "", // 用自定义气泡
    width: 40,
    height: 40,
    callout: {
      content: item.title,
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
      fontSize: 16,
      anchorX: -10,
      anchorY: -10,
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

async function fetchNearbyMatches() {
  loading.value = true;
  try {
    if (!isCloudConfigured()) {
      await new Promise((r) => setTimeout(r, 600));
      matches.value = getMockMatches(latitude.value, longitude.value, radius.value);
      return;
    }
    const res = await callCloud("listNearbyMatches", {
      latitude: latitude.value,
      longitude: longitude.value,
      radius: radius.value,
    });
    if (res && res.ok) {
      matches.value = res.data || [];
    }
  } catch (e) {
    console.warn("[地图] 查询失败", e);
  } finally {
    loading.value = false;
  }
}

function getMockMatches(lat, lon, r) {
  const mock = [
    {
      _id: "mock1",
      title: "周六晚双打",
      place: "学校体育馆",
      latitude: lat + 0.008,
      longitude: lon + 0.006,
      level: "入门至初级",
      startTime: Date.now() + 86400000,
      timeText: "明天 19:00",
      maxPlayers: 4,
      joinedCount: 2,
    },
    {
      _id: "mock2",
      title: "周日晨练",
      place: "大学城羽毛球馆",
      latitude: lat + 0.015,
      longitude: lon - 0.012,
      level: "初级",
      startTime: Date.now() + 86400000 * 2,
      timeText: "后天 09:00",
      maxPlayers: 6,
      joinedCount: 3,
    },
    {
      _id: "mock3",
      title: "周三夜场",
      place: "市体育中心",
      latitude: lat - 0.02,
      longitude: lon + 0.018,
      level: "中级",
      startTime: Date.now() + 86400000 * 4,
      timeText: "下周三 20:00",
      maxPlayers: 8,
      joinedCount: 5,
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

function onMarkerTap(e) {
  const index = e.markerId;
  activeIndex.value = index;
}

function selectMarker(index) {
  activeIndex.value = index;
  const item = matches.value[index];
  if (item) {
    latitude.value = item.latitude;
    longitude.value = item.longitude;
  }
  // 跳转到详情
  uni.navigateTo({ url: "/pages/match-detail/match-detail?id=" + item._id });
}

function onRegionChange(e) {
  // 可选：视野变化时重新加载
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
  try {
    const loc = await getLocation();
    latitude.value = loc.latitude;
    longitude.value = loc.longitude;
    fetchNearbyMatches();
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
  padding: 80rpx 24rpx 20rpx;
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
  width: 520rpx;
  flex-shrink: 0;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
}

.mini-card.active {
  transform: scale(1.02);
}

.mini-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e33;
  margin-bottom: 8rpx;
}

.mini-place {
  display: block;
  font-size: 24rpx;
  color: #607067;
  margin-bottom: 12rpx;
}

.mini-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.mini-time {
  font-size: 24rpx;
  color: #607067;
}

.mini-distance {
  font-size: 24rpx;
  color: #0b6e4f;
  font-weight: 500;
}

.mini-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12rpx;
  border-top: 1rpx solid #eef1ef;
}

.mini-level {
  font-size: 24rpx;
  color: #0b6e4f;
}

.mini-players {
  font-size: 24rpx;
  color: #8a9a90;
}

.mini-detail {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #0b6e4f;
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #eef1ef;
}

.empty-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 28rpx;
  color: #607067;
  background: rgba(255, 255, 255, 0.9);
  padding: 20rpx 40rpx;
  border-radius: 12rpx;
}
</style>

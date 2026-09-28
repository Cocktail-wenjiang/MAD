<template>
  <view class="page">
    <AppTopbar title="附近约球" />

    <!-- 定位状态和筛选 -->
    <view class="location-bar">
      <view class="location-info" @click="refreshLocation">
        <text class="location-icon">📍</text>
        <text class="location-text">{{ locationText }}</text>
        <text class="refresh-text">刷新</text>
      </view>
      <view class="view-toggle">
        <text class="toggle-btn active">列表</text>
        <text class="toggle-btn" @click="goMap">地图</text>
      </view>
      <view class="radius-picker">
        <text
          v-for="r in radiusOptions"
          :key="r"
          class="radius-item"
          :class="{ active: radius === r }"
          @click="changeRadius(r)"
        >{{ r }}km</text>
      </view>

      <!-- 水平筛选 -->
      <view class="level-filter">
        <text class="filter-label">水平筛选</text>
        <scroll-view scroll-x class="level-scroll">
          <view class="level-track">
            <text
              class="level-tag"
              :class="{ active: selectedLevels.length === 0 }"
              @click="clearLevelFilter"
            >全部</text>
            <text
              v-for="lv in levelOptions"
              :key="lv"
              class="level-tag"
              :class="{ active: selectedLevels.includes(lv) }"
              @click="toggleLevel(lv)"
            >{{ lv }}</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="state-wrap">
      <text class="state-text">正在搜索附近的球友...</text>
    </view>

    <!-- 定位失败 -->
    <view v-else-if="locationError" class="state-wrap">
      <text class="state-text">定位失败，请检查定位权限后重试</text>
      <button class="retry-btn" @click="refreshLocation">重新定位</button>
    </view>

    <!-- 空状态 -->
    <view v-else-if="matches.length === 0 && !loading" class="state-wrap">
      <text class="state-text">附近{{ radius }}km 内暂时没有约球活动</text>
      <text class="state-subtitle">要不你来发起一个？</text>
    </view>

    <!-- 约球列表 -->
    <view v-else class="match-list">
      <text class="result-count">找到 {{ matches.length }} 个附近的约球活动</text>
      <ActivityCard
        v-for="item in matches"
        :key="item._id"
        :activity="item"
        @click="goDetail(item)"
      />
    </view>

    <!-- 发布按钮 -->
    <view class="fab-btn" @click="goCreate">
      <text class="fab-icon">+</text>
      <text class="fab-text">发布</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { onShow, onPullDownRefresh } from "@dcloudio/uni-app";
import AppTopbar from "../../components/AppTopbar.vue";
import ActivityCard from "../../components/ActivityCard.vue";
import { requireLogin } from "../../utils/auth";
import { callCloud, isCloudConfigured } from "../../utils/cloud";

const loading = ref(false);
const locationError = ref(false);
const locationText = ref("定位中...");
const matches = ref([]);
const radius = ref(10);
const radiusOptions = [3, 5, 10, 20, 50];
const currentLocation = ref({ latitude: null, longitude: null });
const selectedLevels = ref([]);
const levelOptions = ["入门", "入门至初级", "初级", "初级至中级", "中级", "中级以上"];

// 获取当前定位（gcj02 优先，失败降级为 wgs84）
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

// 搜索附近约球
async function fetchNearbyMatches() {
  if (!currentLocation.value.latitude || !currentLocation.value.longitude) return;

  loading.value = true;
  try {
    if (!isCloudConfigured()) {
      // 云服务未配置时，使用模拟数据演示
      await new Promise((r) => setTimeout(r, 800));
      matches.value = getMockMatches(
        currentLocation.value.latitude,
        currentLocation.value.longitude,
        radius.value,
        selectedLevels.value
      );
    } else {
      const res = await callCloud("listNearbyMatches", {
        latitude: currentLocation.value.latitude,
        longitude: currentLocation.value.longitude,
        radius: radius.value,
        levels: selectedLevels.value.length > 0 ? selectedLevels.value : null,
      });
      if (res && res.ok) {
        matches.value = res.data || [];
      } else {
        matches.value = [];
      }
    }
  } catch (e) {
    console.warn("[附近约球] 查询失败", e);
    matches.value = [];
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

// 刷新定位并搜索
async function refreshLocation() {
  locationError.value = false;
  locationText.value = "定位中...";
  try {
    const loc = await getLocation();
    currentLocation.value = loc;
    locationText.value = "已获取当前位置";
    fetchNearbyMatches();
  } catch (e) {
    console.warn("[附近约球] 定位失败", e);
    locationError.value = true;
    locationText.value = "定位失败";
    loading.value = false;
    matches.value = [];
    uni.stopPullDownRefresh();
  }
}

// 切换搜索半径
function changeRadius(r) {
  radius.value = r;
  if (currentLocation.value.latitude) {
    fetchNearbyMatches();
  }
}

// 切换水平筛选
function toggleLevel(level) {
  const idx = selectedLevels.value.indexOf(level);
  if (idx > -1) {
    selectedLevels.value.splice(idx, 1);
  } else {
    selectedLevels.value.push(level);
  }
  if (currentLocation.value.latitude) {
    fetchNearbyMatches();
  }
}

// 清除水平筛选
function clearLevelFilter() {
  if (selectedLevels.value.length === 0) return;
  selectedLevels.value = [];
  if (currentLocation.value.latitude) {
    fetchNearbyMatches();
  }
}

// 跳转到发布页
function goCreate() {
  uni.navigateTo({ url: "/pages/create-match/create-match" });
}

// 跳转到详情页
function goDetail(item) {
  uni.navigateTo({ url: "/pages/match-detail/match-detail?id=" + item._id });
}

// 跳转到地图视图
function goMap() {
  const lat = currentLocation.value.latitude || "";
  const lon = currentLocation.value.longitude || "";
  uni.navigateTo({ url: `/pages/matches-map/matches-map?lat=${lat}&lon=${lon}` });
}

// 模拟数据（云服务未配置时使用）
function getMockMatches(lat, lon, r, levels = []) {
  const mock = [
    {
      _id: "mock1",
      title: "周六晚双打",
      place: "学校体育馆",
      latitude: lat + 0.01,
      longitude: lon + 0.01,
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
      latitude: lat + 0.03,
      longitude: lon - 0.02,
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
      latitude: lat - 0.05,
      longitude: lon + 0.04,
      level: "中级",
      startTime: Date.now() + 86400000 * 4,
      timeText: "下周三 20:00",
      maxPlayers: 8,
      joinedCount: 5,
    },
    {
      _id: "mock4",
      title: "周五欢乐场",
      place: "阳光羽毛球俱乐部",
      latitude: lat + 0.02,
      longitude: lon + 0.03,
      level: "入门",
      startTime: Date.now() + 86400000 * 3,
      timeText: "本周五 19:30",
      maxPlayers: 6,
      joinedCount: 1,
    },
    {
      _id: "mock5",
      title: "周末高手局",
      place: "精英球馆",
      latitude: lat - 0.03,
      longitude: lon - 0.04,
      level: "中级以上",
      startTime: Date.now() + 86400000 * 5,
      timeText: "下周六 14:00",
      maxPlayers: 4,
      joinedCount: 3,
    },
  ];
  // 计算距离
  const R = 6371;
  return mock
    .filter((item) => !levels || levels.length === 0 || levels.includes(item.level))
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

onShow(() => {
  requireLogin();
});

onMounted(() => {
  refreshLocation();
});

onPullDownRefresh(() => {
  if (locationError.value) {
    refreshLocation();
  } else {
    fetchNearbyMatches();
  }
});
</script>

<style scoped>
.page {
  padding: 30rpx 24rpx 0;
  min-height: 100vh;
  box-sizing: border-box;
  background: #f5f7f6;
}

/* TabBar 底部安全区 */
.page::after {
  content: "";
  display: block;
  height: calc(40rpx + env(safe-area-inset-bottom));
}

.location-bar {
  background: #fff;
  border-radius: 14rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}

.location-info {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.location-icon {
  font-size: 28rpx;
}

.location-text {
  flex: 1;
  font-size: 26rpx;
  color: #2c3e33;
  font-weight: 500;
}

.refresh-text {
  font-size: 24rpx;
  color: #0b6e4f;
}

.view-toggle {
  display: flex;
  margin-top: 20rpx;
  background: #f5f7f6;
  border-radius: 10rpx;
  padding: 4rpx;
}

.toggle-btn {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  font-size: 26rpx;
  color: #607067;
  border-radius: 8rpx;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: #fff;
  color: #0b6e4f;
  font-weight: 500;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

.radius-picker {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #eef1ef;
}

.radius-item {
  flex: 1;
  text-align: center;
  padding: 10rpx 0;
  font-size: 24rpx;
  color: #607067;
  background: #f5f7f6;
  border-radius: 8rpx;
  transition: all 0.2s;
}

.radius-item.active {
  color: #fff;
  background: #0b6e4f;
  font-weight: 500;
}

.level-filter {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eef1ef;
}

.filter-label {
  display: block;
  font-size: 24rpx;
  color: #607067;
  margin-bottom: 14rpx;
}

.level-scroll {
  white-space: nowrap;
}

.level-track {
  display: inline-flex;
  gap: 12rpx;
}

.level-tag {
  flex-shrink: 0;
  padding: 10rpx 22rpx;
  font-size: 24rpx;
  color: #607067;
  background: #f5f7f6;
  border-radius: 20rpx;
  transition: all 0.2s;
}

.level-tag.active {
  color: #fff;
  background: #0b6e4f;
  font-weight: 500;
}

.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}

.state-text {
  font-size: 28rpx;
  color: #607067;
  text-align: center;
}

.state-subtitle {
  font-size: 24rpx;
  color: #8a9a90;
  margin-top: 12rpx;
}

.retry-btn {
  margin-top: 30rpx;
  padding: 16rpx 40rpx;
  font-size: 26rpx;
  color: #fff;
  background: #0b6e4f;
  border-radius: 40rpx;
  border: none;
}

.retry-btn::after {
  border: none;
}

.result-count {
  display: block;
  font-size: 24rpx;
  color: #8a9a90;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}

.match-list {
  padding-bottom: 140rpx;
}

.fab-btn {
  position: fixed;
  right: 30rpx;
  bottom: 60rpx;
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  background: linear-gradient(135deg, #0b6e4f, #0a8a5f);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(11, 110, 79, 0.4);
  z-index: 100;
}

.fab-icon {
  font-size: 40rpx;
  color: #fff;
  font-weight: 300;
  line-height: 1;
}

.fab-text {
  font-size: 20rpx;
  color: #fff;
  margin-top: 4rpx;
}
</style>

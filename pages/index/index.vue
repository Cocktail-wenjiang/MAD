<template>
  <view class="page">
    <AppTopbar title="寻友" action="筛选" @action="showFilter = true" />

    <!-- 定位提示 -->
    <view class="location-bar" @click="refreshLocation">
      <text class="location-icon">📍</text>
      <text class="location-text">{{ locationText }}</text>
      <text class="refresh-text">重新定位</text>
    </view>

    <BannerCarousel :banners="banners" />
    <AICoachCard @open="openCoach" />

    <view class="profile">
      <UserAvatar :name="profile.nickname" />
      <view class="copy">
        <text class="name">{{ profile.nickname }}</text>
        <text class="meta">{{ profile.level }} · {{ profile.region }}</text>
      </view>
      <text class="edit" @tap="uni.switchTab({ url: '/pages/profile/profile' })">我的资料</text>
    </view>

    <!-- 附近球友 -->
    <view class="section-row">
      <text class="section">附近球友</text>
      <view class="section-actions">
        <view class="map-toggle" @click="openMap">
          <text class="map-icon">🗺️</text>
          <text class="map-text">地图</text>
        </view>
        <view class="radius-tabs">
          <text
            v-for="r in radiusOptions"
            :key="r"
            class="radius-tab"
            :class="{ active: radius === r }"
            @click="changeRadius(r)"
          >{{ r }}km</text>
        </view>
      </view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="state-wrap">
      <text class="state-text">正在搜索附近球友...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="friends.length === 0" class="state-wrap">
      <text class="state-text">附近{{ radius }}km 内还没有球友</text>
      <text class="state-subtitle">先分享你的位置，等别人来发现你吧</text>
    </view>

    <!-- 球友列表 -->
    <template v-else>
      <text class="result-count">找到 {{ friends.length }} 位附近的球友</text>
      <FriendCard
        v-for="item in friends"
        :key="item.openid || item.id"
        :friend="item"
        @open="openFriend"
        @chat="startChat"
      />
    </template>

    <!-- 底部安全区留白 (TabBar) -->
    <view class="tabbar-safe"></view>

    <AIFloatingCoach @open="openCoach" />

    <!-- 筛选弹窗 -->
    <view v-if="showFilter" class="filter-mask" @click="showFilter = false">
      <view class="filter-panel" @click.stop>
        <text class="filter-title">筛选条件</text>
        <text class="filter-label">水平要求</text>
        <view class="filter-levels">
          <text
            class="level-tag"
            :class="{ active: filterLevel === '' }"
            @click="setFilterLevel('')"
          >全部</text>
          <text
            v-for="lv in levelOptions"
            :key="lv"
            class="level-tag"
            :class="{ active: filterLevel === lv }"
            @click="setFilterLevel(lv)"
          >{{ lv }}</text>
        </view>
        <button class="filter-btn" @click="applyFilter">确定</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import { onShow, onPullDownRefresh } from "@dcloudio/uni-app";
import AppTopbar from "../../components/AppTopbar.vue";
import BannerCarousel from "../../components/BannerCarousel.vue";
import AICoachCard from "../../components/AICoachCard.vue";
import AIFloatingCoach from "../../components/AIFloatingCoach.vue";
import UserAvatar from "../../components/UserAvatar.vue";
import FriendCard from "../../components/FriendCard.vue";
import { loadProfile } from "../../utils/storage";
import { requireLogin } from "../../utils/auth";
import { callCloud, isCloudConfigured } from "../../utils/cloud";

const profile = ref(
  loadProfile({
    nickname: "羽球新人",
    region: "武汉",
    availability: "周末晚上",
    level: "待测评",
    tags: ["等待首次测评"],
  })
);

const banners = ref([
  { id: "local-1", title: "同校约球，轻松找到搭子", description: "按水平、地区和时间发现合适球友" },
  { id: "local-2", title: "完成自测，记录动作进步", description: "用同机位视频对比每次训练趋势" },
]);

const friends = ref([]);
const loading = ref(false);
const locationText = ref("定位中...");
const radius = ref(10);
const radiusOptions = [3, 5, 10, 20, 50];
const currentLocation = ref({ latitude: null, longitude: null });
const showFilter = ref(false);
const filterLevel = ref("");
const levelOptions = ["入门", "入门至初级", "初级", "初级至中级", "中级", "中级以上"];

// 获取定位（gcj02 优先，失败降级为 wgs84）
function getLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      success: (res) => {
        resolve({ latitude: res.latitude, longitude: res.longitude });
      },
      fail: (err) => {
        // gcj02 失败，降级为 wgs84
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

// 上报位置到云端
async function updateMyLocation(lat, lon) {
  if (!isCloudConfigured()) return;
  try {
    await callCloud("updateLocation", { latitude: lat, longitude: lon });
  } catch (e) {
    console.warn("[寻友] 更新位置失败", e);
  }
}

// 搜索附近球友
async function fetchNearbyFriends() {
  if (!currentLocation.value.latitude || !currentLocation.value.longitude) return;

  loading.value = true;
  try {
    if (!isCloudConfigured()) {
      // 云服务未配置，显示空状态
      friends.value = [];
    } else {
      const res = await callCloud("listNearbyFriends", {
        latitude: currentLocation.value.latitude,
        longitude: currentLocation.value.longitude,
        radius: radius.value,
        level: filterLevel.value || null,
      });
      if (res && res.ok) {
        friends.value = res.data || [];
      }
    }
  } catch (e) {
    console.warn("[寻友] 搜索失败", e);
    friends.value = [];
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

// 刷新定位并搜索
async function refreshLocation() {
  locationText.value = "定位中...";
  try {
    const loc = await getLocation();
    currentLocation.value = loc;
    locationText.value = "已定位到当前位置";
    // 上报位置
    updateMyLocation(loc.latitude, loc.longitude);
    // 搜索附近球友
    fetchNearbyFriends();
  } catch (e) {
    console.warn("[寻友] 定位失败", e);
    locationText.value = "定位失败，点击重试";
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

function changeRadius(r) {
  radius.value = r;
  if (currentLocation.value.latitude) {
    fetchNearbyFriends();
  }
}

function openMap() {
  if (!currentLocation.value.latitude) {
    uni.showToast({ title: "定位中，请稍候", icon: "none" });
    return;
  }
  uni.navigateTo({
    url: `/pages/friends-map/friends-map?lat=${currentLocation.value.latitude}&lon=${currentLocation.value.longitude}&radius=${radius.value}`,
  });
}

function setFilterLevel(lv) {
  filterLevel.value = lv;
}

function applyFilter() {
  showFilter.value = false;
  if (currentLocation.value.latitude) {
    fetchNearbyFriends();
  }
}

function openCoach() {
  uni.navigateTo({ url: "/pages/ai-coach/ai-coach" });
}

function openFriend(friend) {
  uni.showModal({
    title: friend.nickname,
    content: `${friend.region} · ${friend.availability}
${friend.tags.join("、")}
距离：${friend.distanceText}`,
    confirmText: "发起聊天",
    success: (r) => {
      if (r.confirm) {
        startChat(friend);
      }
    },
  });
}

function startChat(friend) {
  uni.navigateTo({
    url: `/pages/chat-detail/chat-detail?peerOpenid=${friend.openid || friend.id}&peerNickname=${encodeURIComponent(friend.nickname)}`,
  });
}

onShow(() => {
  if (!requireLogin()) return;
  profile.value = loadProfile(profile.value);

  callCloud("listBanners", {})
    .then((r) => {
      if (r.banners?.length) banners.value = r.banners;
    })
    .catch(() => {});

  // 进入页面自动定位并搜索
  if (!currentLocation.value.latitude) {
    refreshLocation();
  }
});

onPullDownRefresh(() => {
  refreshLocation();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7f6;
}

/* TabBar 底部安全区 */
.tabbar-safe {
  height: calc(100rpx + env(safe-area-inset-bottom));
}

.location-bar {
  display: flex;
  align-items: center;
  margin: 0 24rpx 20rpx;
  padding: 18rpx 24rpx;
  background: #fff;
  border-radius: 12rpx;
  gap: 12rpx;
}

.location-icon {
  font-size: 28rpx;
}

.location-text {
  flex: 1;
  font-size: 26rpx;
  color: #2c3e33;
}

.refresh-text {
  font-size: 24rpx;
  color: #0b6e4f;
}

.notice {
  padding: 24rpx 32rpx;
  color: #777;
  font-size: 25rpx;
}

.profile {
  margin: 20rpx 24rpx 30rpx;
  padding: 26rpx 24rpx;
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12rpx;
}

.copy {
  flex: 1;
  margin-left: 20rpx;
}

.name {
  display: block;
  font-size: 31rpx;
  font-weight: 600;
}

.meta {
  display: block;
  margin-top: 8rpx;
  color: #888;
  font-size: 24rpx;
}

.edit {
  color: #576b95;
  font-size: 25rpx;
}

.section-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24rpx 18rpx;
}

.section {
  color: #888;
  font-size: 25rpx;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.map-toggle {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  background: #e6f4ee;
  border-radius: 20rpx;
}

.map-icon {
  font-size: 22rpx;
}

.map-text {
  font-size: 22rpx;
  color: #0b6e4f;
  font-weight: 500;
}

.radius-tabs {
  display: flex;
  gap: 10rpx;
}

.radius-tab {
  font-size: 22rpx;
  color: #607067;
  padding: 6rpx 16rpx;
  background: #e8eee9;
  border-radius: 20rpx;
}

.radius-tab.active {
  color: #fff;
  background: #0b6e4f;
}

.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
}

.state-text {
  font-size: 28rpx;
  color: #607067;
}

.state-subtitle {
  font-size: 24rpx;
  color: #8a9a90;
  margin-top: 10rpx;
}

.result-count {
  display: block;
  padding: 0 32rpx 12rpx;
  font-size: 22rpx;
  color: #8a9a90;
}

/* 筛选弹窗 */
.filter-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.filter-panel {
  width: 100%;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 28rpx calc(40rpx + env(safe-area-inset-bottom));
}

.filter-title {
  display: block;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #2c3e33;
  margin-bottom: 30rpx;
}

.filter-label {
  display: block;
  font-size: 26rpx;
  color: #607067;
  margin-bottom: 16rpx;
}

.filter-levels {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 40rpx;
}

.level-tag {
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #607067;
  background: #f5f7f6;
  border-radius: 30rpx;
}

.level-tag.active {
  color: #fff;
  background: #0b6e4f;
  font-weight: 500;
}

.filter-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  color: #fff;
  background: #0b6e4f;
  border-radius: 44rpx;
  border: none;
}

.filter-btn::after {
  border: none;
}
</style>

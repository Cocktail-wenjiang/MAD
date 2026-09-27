<template>
  <view class="page">
    <AppTopbar title="发布约球" />

    <view class="form">
      <!-- 标题 -->
      <view class="form-item">
        <text class="label">活动标题</text>
        <input
          class="input"
          v-model="form.title"
          placeholder="例如：周六晚双打"
          maxlength="20"
        />
      </view>

      <!-- 地点选择 -->
      <view class="form-item">
        <text class="label">活动地点</text>
        <view class="location-picker" @click="showPlacePicker = true">
          <text v-if="form.place" class="place-text">{{ form.place }}</text>
          <text v-else class="placeholder">点击选择球馆</text>
          <text class="arrow">›</text>
        </view>
        <text v-if="form.place" class="place-address">{{ form.address || "" }}</text>
      </view>

      <!-- 时间选择 -->
      <view class="form-item">
        <text class="label">开始时间</text>
        <picker mode="date" :value="dateStr" :start="todayStr" @change="onDateChange">
          <view class="picker">
            <text :class="{ placeholder: !dateStr }">{{ dateStr || "选择日期" }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
        <picker mode="time" :value="timeStr" @change="onTimeChange" class="time-picker">
          <view class="picker">
            <text :class="{ placeholder: !timeStr }">{{ timeStr || "选择时间" }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>

      <!-- 时长 -->
      <view class="form-item">
        <text class="label">活动时长</text>
        <view class="duration-options">
          <text
            v-for="d in durationOptions"
            :key="d"
            class="duration-item"
            :class="{ active: form.duration === d }"
            @click="form.duration = d"
          >{{ d }}小时</text>
        </view>
      </view>

      <!-- 水平要求 -->
      <view class="form-item">
        <text class="label">水平要求</text>
        <view class="level-options">
          <text
            v-for="lv in levelOptions"
            :key="lv"
            class="level-item"
            :class="{ active: form.level === lv }"
            @click="form.level = lv"
          >{{ lv }}</text>
        </view>
      </view>

      <!-- 人数 -->
      <view class="form-item">
        <text class="label">最大人数</text>
        <view class="stepper">
          <text class="step-btn" @click="changePlayers(-1)">-</text>
          <text class="step-value">{{ form.maxPlayers }}人</text>
          <text class="step-btn" @click="changePlayers(1)">+</text>
        </view>
      </view>

      <!-- 备注 -->
      <view class="form-item">
        <text class="label">补充说明</text>
        <textarea
          class="textarea"
          v-model="form.note"
          placeholder="例如：自带球拍，费用AA，水平相近..."
          maxlength="100"
        />
        <text class="char-count">{{ form.note.length }}/100</text>
      </view>
    </view>

    <!-- 发布按钮 -->
    <view class="footer">
      <button class="submit-btn" :disabled="!canSubmit || submitting" @click="submit">
        {{ submitting ? "发布中..." : "发布约球" }}
      </button>
    </view>

    <!-- 球馆选择弹窗 -->
    <view v-if="showPlacePicker" class="picker-mask" @click="closePlacePicker">
      <view class="picker-panel" @click.stop>
        <view class="picker-header">
          <text class="picker-title">选择球馆</text>
          <text class="picker-close" @click="closePlacePicker">关闭</text>
        </view>

        <!-- 搜索框 -->
        <view class="search-bar">
          <text class="search-icon">🔍</text>
          <input
            class="search-input"
            v-model="searchKeyword"
            placeholder="搜索球馆名称"
            confirm-type="search"
            @confirm="searchPlaces"
          />
          <text v-if="searchKeyword" class="search-clear" @click="clearSearch">✕</text>
        </view>

        <!-- 操作按钮 -->
        <view class="picker-actions">
          <text class="action-btn" @click="loadNearby">
            <text class="action-icon">📍</text> 附近球馆
          </text>
          <!-- #ifdef MP-WEIXIN -->
          <text class="action-btn" @click="chooseWxLocation">
            <text class="action-icon">🗺️</text> 地图选点
          </text>
          <!-- #endif -->
        </view>

        <!-- 列表 -->
        <scroll-view class="place-list" scroll-y @scrolltolower="loadMore">
          <view v-if="placeLoading" class="list-loading">
            <text>搜索中...</text>
          </view>

          <view v-else-if="placeList.length === 0" class="list-empty">
            <text>{{ searchKeyword ? "没有找到相关球馆" : "点击上方按钮搜索附近球馆" }}</text>
          </view>

          <view
            v-for="item in placeList"
            :key="item.id"
            class="place-item"
            @click="selectPlace(item)"
          >
            <view class="place-info">
              <text class="place-name">{{ item.name }}</text>
              <text class="place-addr">{{ item.address }}</text>
            </view>
            <text v-if="item.distanceText" class="place-dist">{{ item.distanceText }}</text>
          </view>

          <view v-if="placeList.length > 0 && hasMorePlace" class="list-footer">
            <text>加载更多...</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import AppTopbar from "../../components/AppTopbar.vue";
import { callCloud, isCloudConfigured } from "../../utils/cloud";

const form = ref({
  title: "",
  place: "",
  address: "",
  latitude: null,
  longitude: null,
  dateStr: "",
  timeStr: "",
  duration: 2,
  level: "入门至初级",
  maxPlayers: 4,
  note: "",
});

const submitting = ref(false);

const durationOptions = [1, 1.5, 2, 2.5, 3];
const levelOptions = ["入门", "入门至初级", "初级", "初级至中级", "中级", "中级以上"];

const todayStr = computed(() => {
  const d = new Date();
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
});

const dateStr = computed({
  get: () => form.value.dateStr,
  set: (v) => (form.value.dateStr = v),
});

const timeStr = computed({
  get: () => form.value.timeStr,
  set: (v) => (form.value.timeStr = v),
});

const canSubmit = computed(() => {
  return (
    form.value.title.trim() &&
    form.value.place &&
    form.value.latitude !== null &&
    form.value.longitude !== null &&
    form.value.dateStr &&
    form.value.timeStr &&
    form.value.level
  );
});

// ========== 球馆选择 ==========
const showPlacePicker = ref(false);
const searchKeyword = ref("");
const placeList = ref([]);
const placeLoading = ref(false);
const placePage = ref(1);
const hasMorePlace = ref(false);
const currentLocation = ref({ latitude: null, longitude: null });
const searchMode = ref(""); // nearby / search

function openPlacePicker() {
  showPlacePicker.value = true;
  searchKeyword.value = "";
  placeList.value = [];
  placePage.value = 1;
  hasMorePlace.value = false;
}

function closePlacePicker() {
  showPlacePicker.value = false;
}

// 获取定位
function getLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
      fail: (err) => {
        uni.getLocation({
          type: "wgs84",
          isHighAccuracy: false,
          success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
          fail: (err2) => reject(err2 || err),
        });
      },
    });
  });
}

// 加载附近球馆
async function loadNearby() {
  if (placeLoading.value) return;

  // 先获取定位
  if (!currentLocation.value.latitude) {
    try {
      const loc = await getLocation();
      currentLocation.value = loc;
    } catch (e) {
      uni.showToast({ title: "定位失败，请检查权限", icon: "none" });
      return;
    }
  }

  placeLoading.value = true;
  searchMode.value = "nearby";
  placePage.value = 1;

  try {
    if (!isCloudConfigured()) {
      // 模拟数据
      await new Promise((r) => setTimeout(r, 600));
      placeList.value = getMockVenues(currentLocation.value.latitude, currentLocation.value.longitude);
      hasMorePlace.value = false;
    } else {
      const res = await callCloud("amap", {
        action: "nearby",
        latitude: currentLocation.value.latitude,
        longitude: currentLocation.value.longitude,
        keyword: searchKeyword.value || "羽毛球馆",
        radius: 5000,
        page: 1,
        offset: 20,
      });

      if (res && res.ok) {
        placeList.value = res.list || [];
        hasMorePlace.value = res.total > placeList.value.length;
      } else {
        placeList.value = [];
      }
    }
  } catch (e) {
    console.warn("[附近球馆] 搜索失败", e);
    placeList.value = [];
  } finally {
    placeLoading.value = false;
  }
}

// 关键词搜索
async function searchPlaces() {
  if (placeLoading.value) return;
  if (!searchKeyword.value.trim()) {
    loadNearby();
    return;
  }

  placeLoading.value = true;
  searchMode.value = "search";
  placePage.value = 1;

  try {
    if (!isCloudConfigured()) {
      await new Promise((r) => setTimeout(r, 500));
      placeList.value = getMockVenues(30.5, 114.3).filter((v) =>
        v.name.includes(searchKeyword.value)
      );
      hasMorePlace.value = false;
    } else {
      const res = await callCloud("amap", {
        action: "search",
        keyword: searchKeyword.value,
        city: "",
        page: 1,
        offset: 20,
      });

      if (res && res.ok) {
        placeList.value = res.list || [];
        hasMorePlace.value = res.total > placeList.value.length;
      }
    }
  } catch (e) {
    console.warn("[球馆搜索] 失败", e);
  } finally {
    placeLoading.value = false;
  }
}

// 加载更多
async function loadMore() {
  if (placeLoading.value || !hasMorePlace.value) return;
  placeLoading.value = true;
  placePage.value += 1;

  try {
    let res;
    if (searchMode.value === "nearby" && currentLocation.value.latitude) {
      res = await callCloud("amap", {
        action: "nearby",
        latitude: currentLocation.value.latitude,
        longitude: currentLocation.value.longitude,
        keyword: searchKeyword.value || "羽毛球馆",
        radius: 5000,
        page: placePage.value,
        offset: 20,
      });
    } else if (searchMode.value === "search") {
      res = await callCloud("amap", {
        action: "search",
        keyword: searchKeyword.value,
        page: placePage.value,
        offset: 20,
      });
    }

    if (res && res.ok) {
      placeList.value = [...placeList.value, ...(res.list || [])];
      hasMorePlace.value = res.total > placeList.value.length;
    }
  } catch (e) {
    console.warn("[加载更多] 失败", e);
  } finally {
    placeLoading.value = false;
  }
}

// 微信小程序地图选点
function chooseWxLocation() {
  uni.chooseLocation({
    success: (res) => {
      form.value.place = res.name || res.address;
      form.value.address = res.address || "";
      form.value.latitude = res.latitude;
      form.value.longitude = res.longitude;
      closePlacePicker();
    },
    fail: (err) => {
      console.warn("[地图选点] 失败", err);
      uni.showToast({ title: "请开启位置权限", icon: "none" });
    },
  });
}

// 选择球馆
function selectPlace(item) {
  form.value.place = item.name;
  form.value.address = item.address;
  form.value.latitude = item.latitude;
  form.value.longitude = item.longitude;
  closePlacePicker();
}

function clearSearch() {
  searchKeyword.value = "";
  if (currentLocation.value.latitude) {
    loadNearby();
  } else {
    placeList.value = [];
  }
}

// 模拟球馆数据
function getMockVenues(lat, lon) {
  return [
    {
      id: "mock_v1",
      name: "武汉体育中心羽毛球馆",
      address: "湖北省武汉市蔡甸区车城北路58号",
      latitude: lat + 0.01,
      longitude: lon + 0.008,
      distance: 1.2,
      distanceText: "1.2km",
    },
    {
      id: "mock_v2",
      name: "光谷羽毛球俱乐部",
      address: "湖北省武汉市洪山区珞喻路1037号",
      latitude: lat + 0.02,
      longitude: lon - 0.015,
      distance: 2.8,
      distanceText: "2.8km",
    },
    {
      id: "mock_v3",
      name: "洪山体育馆羽毛球馆",
      address: "湖北省武汉市武昌区新民主路541号",
      latitude: lat - 0.012,
      longitude: lon + 0.025,
      distance: 3.5,
      distanceText: "3.5km",
    },
    {
      id: "mock_v4",
      name: "楚天羽毛球培训中心",
      address: "湖北省武汉市江汉区解放大道128号",
      latitude: lat + 0.03,
      longitude: lon + 0.02,
      distance: 4.2,
      distanceText: "4.2km",
    },
  ];
}

// ========== 表单逻辑 ==========

function onDateChange(e) {
  form.value.dateStr = e.detail.value;
}

function onTimeChange(e) {
  form.value.timeStr = e.detail.value;
}

function changePlayers(delta) {
  const next = form.value.maxPlayers + delta;
  if (next >= 2 && next <= 20) {
    form.value.maxPlayers = next;
  }
}

function buildTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0).getTime();
}

async function submit() {
  if (!canSubmit.value) return;

  const startTime = buildTimestamp(form.value.dateStr, form.value.timeStr);
  if (!startTime || startTime < Date.now() - 60 * 1000) {
    uni.showToast({ title: "活动时间不能早于当前时间", icon: "none" });
    return;
  }

  submitting.value = true;
  try {
    if (!isCloudConfigured()) {
      await new Promise((r) => setTimeout(r, 1000));
      uni.showToast({ title: "发布成功（模拟）", icon: "success" });
      setTimeout(() => uni.navigateBack(), 1000);
      return;
    }

    const res = await callCloud("createMatch", {
      title: form.value.title.trim(),
      place: form.value.place,
      address: form.value.address,
      latitude: form.value.latitude,
      longitude: form.value.longitude,
      startTime,
      endTime: startTime + form.value.duration * 60 * 60 * 1000,
      level: form.value.level,
      maxPlayers: form.value.maxPlayers,
      note: form.value.note.trim(),
    });

    if (res && res.ok) {
      uni.showToast({ title: "发布成功", icon: "success" });
      setTimeout(() => uni.navigateBack(), 1000);
    } else {
      uni.showToast({ title: res?.msg || "发布失败", icon: "none" });
    }
  } catch (e) {
    console.warn("[发布约球] 失败", e);
    uni.showToast({ title: "发布失败，请重试", icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7f6;
  padding-bottom: 180rpx;
}

.form {
  padding: 24rpx;
}

.form-item {
  background: #fff;
  border-radius: 14rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #2c3e33;
  margin-bottom: 16rpx;
}

.input {
  width: 100%;
  height: 72rpx;
  font-size: 28rpx;
  color: #2c3e33;
  background: #f5f7f6;
  border-radius: 10rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.location-picker,
.picker {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: #f5f7f6;
  border-radius: 10rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.place-text,
.picker text:first-child {
  flex: 1;
  color: #2c3e33;
}

.placeholder {
  color: #8a9a90;
}

.arrow {
  color: #8a9a90;
  font-size: 32rpx;
}

.place-address {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #8a9a90;
}

.time-picker {
  margin-top: 12rpx;
}

.duration-options,
.level-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.duration-item,
.level-item {
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #607067;
  background: #f5f7f6;
  border-radius: 30rpx;
  transition: all 0.2s;
}

.duration-item.active,
.level-item.active {
  color: #fff;
  background: #0b6e4f;
  font-weight: 500;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 30rpx;
}

.step-btn {
  width: 60rpx;
  height: 60rpx;
  line-height: 56rpx;
  text-align: center;
  font-size: 36rpx;
  color: #0b6e4f;
  background: #f5f7f6;
  border-radius: 50%;
  font-weight: 600;
}

.step-value {
  font-size: 30rpx;
  color: #2c3e33;
  font-weight: 500;
  min-width: 100rpx;
  text-align: center;
}

.textarea {
  width: 100%;
  height: 160rpx;
  font-size: 28rpx;
  color: #2c3e33;
  background: #f5f7f6;
  border-radius: 10rpx;
  padding: 16rpx 20rpx;
  box-sizing: border-box;
}

.char-count {
  display: block;
  text-align: right;
  font-size: 22rpx;
  color: #8a9a90;
  margin-top: 8rpx;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  color: #fff;
  background: #0b6e4f;
  border-radius: 44rpx;
  border: none;
}

.submit-btn::after {
  border: none;
}

.submit-btn[disabled] {
  background: #b8c8be;
  color: #fff;
}

/* 球馆选择弹窗 */
.picker-mask {
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

.picker-panel {
  width: 100%;
  max-height: 80vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #2c3e33;
}

.picker-close {
  font-size: 26rpx;
  color: #8a9a90;
}

.search-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  gap: 12rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.search-icon {
  font-size: 28rpx;
}

.search-input {
  flex: 1;
  height: 68rpx;
  font-size: 28rpx;
  background: #f5f7f6;
  border-radius: 34rpx;
  padding: 0 24rpx;
}

.search-clear {
  font-size: 26rpx;
  color: #aaa;
  padding: 0 8rpx;
}

.picker-actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 68rpx;
  font-size: 26rpx;
  color: #0b6e4f;
  background: #e8f5ef;
  border-radius: 10rpx;
}

.action-icon {
  font-size: 28rpx;
}

.place-list {
  flex: 1;
  min-height: 400rpx;
  max-height: 50vh;
}

.list-loading,
.list-empty {
  padding: 80rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #8a9a90;
}

.place-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.place-info {
  flex: 1;
  min-width: 0;
}

.place-name {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #2c3e33;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.place-addr {
  display: block;
  font-size: 22rpx;
  color: #8a9a90;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.place-dist {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #0b6e4f;
  margin-left: 16rpx;
}

.list-footer {
  padding: 24rpx;
  text-align: center;
  font-size: 24rpx;
  color: #aaa;
}
</style>

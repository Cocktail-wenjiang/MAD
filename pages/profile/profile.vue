<template>
  <view class="page">
    <AppTopbar title="我的" :action="editing ? '保存' : '编辑'" @action="toggleEdit" />

    <view class="head">
      <!-- 微信小程序：编辑模式下点击头像可选择微信头像 -->
      <!-- #ifdef MP-WEIXIN -->
      <button v-if="editing" class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image v-if="profile.avatar" class="avatar-img" :src="profile.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="avatar-text">{{ profile.nickname?.charAt(0) || '羽' }}</text>
        </view>
        <text class="avatar-hint">点击更换头像</text>
      </button>
      <view v-else class="avatar-wrap">
        <image v-if="profile.avatar" class="avatar-img" :src="profile.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="avatar-text">{{ profile.nickname?.charAt(0) || '羽' }}</text>
        </view>
      </view>
      <!-- #endif -->

      <!-- 非微信小程序：普通头像展示 -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="avatar-wrap" @click="editing && chooseAvatar">
        <image v-if="profile.avatar" class="avatar-img" :src="profile.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="avatar-text">{{ profile.nickname?.charAt(0) || '羽' }}</text>
        </view>
        <text v-if="editing" class="avatar-hint">点击更换头像</text>
      </view>
      <!-- #endif -->

      <text class="nickname">{{ profile.nickname }}</text>
      <text class="level">{{ profile.level }}</text>
    </view>

    <view class="form">
      <view class="row">
        <text>昵称</text>
        <!-- 微信小程序：使用 type="nickname" 一键填入微信昵称 -->
        <!-- #ifdef MP-WEIXIN -->
        <input
          v-if="editing"
          type="nickname"
          class="nickname-input"
          v-model="profile.nickname"
          placeholder="点击填写微信昵称"
          placeholder-class="input-placeholder"
        />
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <input v-if="editing" v-model="profile.nickname" placeholder="请输入昵称" />
        <!-- #endif -->
        <text v-else class="value">{{ profile.nickname }}</text>
      </view>
      <view class="row">
        <text>地区</text>
        <input v-if="editing" v-model="profile.region" placeholder="请输入地区" />
        <text v-else class="value">{{ profile.region }}</text>
      </view>
      <view class="row">
        <text>常用时段</text>
        <input v-if="editing" v-model="profile.availability" placeholder="如：周末晚上" />
        <text v-else class="value">{{ profile.availability }}</text>
      </view>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <view v-if="editing" class="wx-tip">
      <text class="wx-tip-icon">💡</text>
      <text class="wx-tip-text">点击头像可选择微信头像，点击昵称栏可一键填入微信昵称</text>
    </view>
    <!-- #endif -->

    <text class="section">能力标签</text>
    <TagList :tags="profile.tags" />

    <text class="section">展示视频</text>
    <view class="video-row">
      <view>
        <text>给球友看的练习片段</text>
        <text class="note">默认关闭，需主动上传并公开</text>
      </view>
      <switch
        :checked="displayVideoPublic"
        @change="displayVideoPublic = $event.detail.value"
        color="#07C160"
      />
    </view>
    <button v-if="editing" class="video-button" @tap="chooseVideo">
      {{ profile.displayVideo ? "更换展示视频" : "上传展示视频" }}
    </button>
    <button v-else class="logout" @tap="logout">退出当前账号</button>
  </view>
</template>

<script setup>
import { ref, reactive } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTopbar from "../../components/AppTopbar.vue";
import TagList from "../../components/TagList.vue";
import { requireLogin } from "../../utils/auth";
import { loadProfile, saveProfile, clearSession } from "../../utils/storage";
import { callCloud, uploadFile, isCloudConfigured } from "../../utils/cloud";

const profile = reactive(
  loadProfile({
    nickname: "羽球新人",
    region: "武汉",
    availability: "周末晚上",
    level: "待测评",
    tags: ["等待首次测评"],
    displayVideo: "",
    avatar: "",
  })
);

const editing = ref(false),
  displayVideoPublic = ref(false);

onShow(() => {
  if (!requireLogin()) return;
  Object.assign(profile, loadProfile(profile));
  displayVideoPublic.value = !!profile.displayVideoPublic;
});

function save() {
  profile.displayVideoPublic = displayVideoPublic.value;
  saveProfile(profile);
  callCloud("syncUser", { profile }).catch(() => {});
  editing.value = false;
  uni.showToast({ title: "资料已保存", icon: "success" });
}

function toggleEdit() {
  if (editing.value) save();
  else editing.value = true;
}

// 微信小程序：选择微信头像
async function onChooseAvatar(e) {
  const { avatarUrl } = e.detail;
  profile.avatar = avatarUrl; // 先显示本地预览
  // 上传到云存储，替换为永久链接
  if (isCloudConfigured()) {
    uni.showLoading({ title: "上传头像..." });
    try {
      const ext = avatarUrl.split(".").pop() || "jpg";
      const cloudPath = `avatar/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const res = await uploadFile({ filePath: avatarUrl, cloudPath });
      if (res && res.fileID) {
        profile.avatar = res.fileID;
        saveProfile(profile);
        callCloud("syncUser", { profile }).catch(() => {});
      }
    } catch (err) {
      console.error("[羽友] 头像上传失败:", err);
      uni.showToast({ title: "头像上传失败，使用本地预览", icon: "none" });
    } finally {
      uni.hideLoading();
    }
  }
  uni.showToast({ title: "头像已更新", icon: "success" });
}

// 非微信小程序：从相册选头像
async function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0];
      profile.avatar = tempPath; // 先显示本地预览
      if (isCloudConfigured()) {
        uni.showLoading({ title: "上传头像..." });
        try {
          const ext = tempPath.split(".").pop() || "jpg";
          const cloudPath = `avatar/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const uploadRes = await uploadFile({ filePath: tempPath, cloudPath });
          if (uploadRes && uploadRes.fileID) {
            profile.avatar = uploadRes.fileID;
            saveProfile(profile);
            callCloud("syncUser", { profile }).catch(() => {});
          }
        } catch (err) {
          console.error("[羽友] 头像上传失败:", err);
          uni.showToast({ title: "头像上传失败", icon: "none" });
        } finally {
          uni.hideLoading();
        }
      }
    },
  });
}

// 选择展示视频并上传到云存储
async function chooseVideo() {
  uni.chooseVideo({
    sourceType: ["album", "camera"],
    maxDuration: 60,
    success: async (r) => {
      const tempPath = r.tempFilePath;
      profile.displayVideo = tempPath; // 先显示本地预览
      if (isCloudConfigured()) {
        uni.showLoading({ title: "上传视频..." });
        try {
          const ext = tempPath.split(".").pop() || "mp4";
          const cloudPath = `videos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const uploadRes = await uploadFile({ filePath: tempPath, cloudPath });
          if (uploadRes && uploadRes.fileID) {
            profile.displayVideo = uploadRes.fileID;
            saveProfile(profile);
            callCloud("syncUser", { profile }).catch(() => {});
          }
        } catch (err) {
          console.error("[羽友] 视频上传失败:", err);
          uni.showToast({ title: "视频上传失败", icon: "none" });
        } finally {
          uni.hideLoading();
        }
      }
    },
  });
}

function logout() {
  uni.showModal({
    title: "退出登录",
    content: "确定要退出当前账号吗？",
    success: (res) => {
      if (res.confirm) {
        clearSession();
        uni.redirectTo({ url: "/pages/login/login" });
      }
    },
  });
}
</script>

<style scoped>
.page {
  padding-bottom: calc(50rpx + env(safe-area-inset-bottom));
}

.head {
  padding: 46rpx 0 40rpx;
  text-align: center;
  background: #fff;
}

/* 头像样式 */
.avatar-btn {
  width: 160rpx;
  height: 160rpx;
  margin: 0 auto;
  padding: 0;
  background: transparent;
  border: none;
  line-height: 1;
  position: relative;
}
.avatar-btn::after {
  border: none;
}

.avatar-wrap {
  width: 160rpx;
  height: 160rpx;
  margin: 0 auto;
  position: relative;
}

.avatar-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #eef1ef;
}

.avatar-placeholder {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #0b6e4f, #0a8a5f);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.avatar-text {
  font-size: 56rpx;
  color: #fff;
  font-weight: 600;
}

.avatar-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #0b6e4f;
  background: #e6f4ee;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  position: absolute;
  bottom: -36rpx;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}

.nickname {
  display: block;
  margin-top: 40rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #2c3e33;
}

.level {
  display: block;
  margin-top: 10rpx;
  color: #8a9a90;
  font-size: 26rpx;
}

.form {
  margin-top: 22rpx;
  padding: 0 32rpx;
  background: #fff;
}

.row {
  min-height: 96rpx;
  display: flex;
  align-items: center;
  border-bottom: 1rpx solid #eef1ef;
}

.row > text:first-child {
  width: 170rpx;
  color: #607067;
  font-size: 28rpx;
  flex-shrink: 0;
}

.row input,
.value {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
  color: #2c3e33;
  min-width: 0;
}

.value {
  color: #8a9a90;
}

.nickname-input {
  text-align: right;
}

.input-placeholder {
  color: #b8c8be;
  font-size: 26rpx;
}

/* 微信提示 */
.wx-tip {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin: 20rpx 32rpx 0;
  padding: 16rpx 20rpx;
  background: #fffbe6;
  border-radius: 12rpx;
}

.wx-tip-icon {
  font-size: 24rpx;
  flex-shrink: 0;
}

.wx-tip-text {
  flex: 1;
  font-size: 22rpx;
  color: #d48806;
  line-height: 1.5;
}

.section {
  display: block;
  padding: 34rpx 32rpx 16rpx;
  color: #8a9a90;
  font-size: 25rpx;
}

.video-row {
  padding: 24rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
}

.note {
  display: block;
  margin-top: 8rpx;
  color: #8a9a90;
  font-size: 23rpx;
}

.video-button,
.logout {
  margin: 20rpx 32rpx;
  color: #07c160;
  background: #fff;
  border: 1rpx solid #07c160;
  font-size: 28rpx;
}
</style>

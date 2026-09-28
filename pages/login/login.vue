<template>
  <view class="page">
    <view class="brand">羽</view>
    <text class="title">欢迎来到羽友</text>
    <text class="subtitle">找到合适球友，记录每一次进步</text>
    <view v-if="mode === 'user'" class="card">
      <text class="card-title">当前登录账号</text>
      <view class="account">
        <view class="icon">友</view>
        <view class="copy">
          <text class="name">羽球新人</text>
          <text class="note">普通用户 · 查看自己的测评趋势和训练建议</text>
        </view>
        <text class="ready">已准备</text>
      </view>
      <button class="primary" @tap="confirmUserLogin">确认本账号登录</button>
      <text class="admin-link" @tap="mode = 'admin'">管理员登录</text>
    </view>
    <view v-else class="card admin-card">
      <text class="card-title">管理员登录</text>
      <text class="hint">请输入初始管理员账号</text>
      <input class="input" v-model="adminUsername" placeholder="账号" maxlength="30" />
      <input class="input" v-model="adminPassword" password placeholder="密码" maxlength="30" />
      <button class="primary" @tap="confirmAdminLogin">确认管理员登录</button>
      <text class="account-hint">初始账号：admin　初始密码：admin123</text>
      <text class="admin-link" @tap="backToUser">返回普通用户登录</text>
    </view>
    <text v-if="error" class="error">{{ error }}</text>
    <text class="footnote">本版本为课程演示，账号仅用于展示角色权限。</text>
  </view>
</template>
<script setup>
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { saveProfile, saveSession } from "../../utils/storage";
import { loadSession } from "../../utils/storage";
import { callCloud } from "../../utils/cloud";
const mode = ref("user"),
  adminUsername = ref(""),
  adminPassword = ref(""),
  error = ref("");
const USER = { role: "user", nickname: "羽球新人", region: "武汉", availability: "周末晚上" };
const ADMIN = {
  username: "admin",
  password: "admin123",
  role: "admin",
  nickname: "羽友管理员",
  region: "武汉",
  availability: "工作日 18:00 后",
};
onShow(() => {
  if (loadSession()) uni.switchTab({ url: "/pages/index/index" });
});
function complete(account) {
  const session = {
    role: account.role,
    nickname: account.nickname,
    username: account.username || "demo-user",
    loggedInAt: new Date().toISOString(),
  };
  saveSession(session);
  saveProfile({
    ...uni.getStorageSync("badminton_friend_profile"),
    nickname: account.nickname,
    region: account.region,
    availability: account.availability,
  });
  callCloud("syncUser", {
    profile: uni.getStorageSync("badminton_friend_profile"),
    role: account.role,
  }).catch(() => {});
  uni.switchTab({ url: "/pages/index/index" });
}
function confirmUserLogin() {
  complete(USER);
}
function confirmAdminLogin() {
  if (adminUsername.value !== ADMIN.username || adminPassword.value !== ADMIN.password) {
    error.value = "管理员账号或密码不正确。";
    return;
  }
  complete(ADMIN);
}
function backToUser() {
  mode.value = "user";
  adminUsername.value = "";
  adminPassword.value = "";
  error.value = "";
}
</script>
<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: calc(150rpx + env(safe-area-inset-top)) 34rpx calc(60rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #eaf9f0 0%, #f7f7f7 48%);
  text-align: center;
}
.brand {
  margin: 0 auto 24rpx;
  width: 116rpx;
  height: 116rpx;
  border-radius: 36rpx;
  line-height: 116rpx;
  color: #fff;
  background: #07c160;
  font-size: 62rpx;
  font-weight: 700;
}
.title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
}
.subtitle {
  display: block;
  margin-top: 16rpx;
  color: #6d756f;
  font-size: 26rpx;
}
.card {
  position: relative;
  margin-top: 72rpx;
  padding: 32rpx 26rpx 52rpx;
  border-radius: 20rpx;
  background: #fff;
  text-align: left;
  box-shadow: 0 10rpx 35rpx rgba(0, 0, 0, 0.05);
}
.card-title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 29rpx;
  font-weight: 600;
}
.account {
  display: flex;
  align-items: center;
  padding: 22rpx;
  border: 2rpx solid #e4eee7;
  border-radius: 14rpx;
  background: #f7fcf8;
}
.icon {
  width: 66rpx;
  height: 66rpx;
  border-radius: 50%;
  line-height: 66rpx;
  text-align: center;
  color: #07c160;
  background: #e7f8ed;
  font-weight: 600;
}
.copy {
  flex: 1;
  margin-left: 18rpx;
}
.name,
.note {
  display: block;
}
.name {
  font-size: 28rpx;
}
.note {
  margin-top: 7rpx;
  color: #8a8a8a;
  font-size: 22rpx;
}
.ready {
  color: #07c160;
  font-size: 22rpx;
}
.primary {
  margin-top: 32rpx;
  height: 88rpx;
  line-height: 88rpx;
  color: #fff;
  background: #07c160;
  border-radius: 10rpx;
}
.admin-link {
  position: absolute;
  right: 26rpx;
  bottom: 16rpx;
  color: #576b95;
  font-size: 21rpx;
}
.admin-card {
  padding-bottom: 64rpx;
}
.hint {
  display: block;
  margin-bottom: 18rpx;
  color: #888;
  font-size: 23rpx;
}
.input {
  height: 78rpx;
  margin-top: 16rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  border: 1rpx solid #e6e6e6;
  border-radius: 8rpx;
  background: #fafafa;
}
.account-hint {
  display: block;
  margin-top: 16rpx;
  color: #999;
  font-size: 21rpx;
}
.error {
  display: block;
  margin-top: 16rpx;
  color: #fa5151;
  font-size: 23rpx;
  text-align: center;
}
.footnote {
  display: block;
  margin-top: 40rpx;
  color: #a0a0a0;
  font-size: 22rpx;
}
</style>

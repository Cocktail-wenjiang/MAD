<template>
  <view class="page">
    <AppTopbar :title="role === 'admin' ? '用户管理' : '测评趋势'" />
    <view class="topline">
      <text>{{ role === "admin" ? "管理员演示账号" : "只展示当前账号的测评记录" }}</text>
      <text class="logout" @tap="logout">退出</text>
    </view>
    <view class="source">数据来源：{{ source }}</view>
    <template v-if="role === 'user'">
      <TrendStat :stats="stats" />
      <text class="section">历史测评</text>
      <view v-if="history.length" class="history">
        <view v-for="item in history" :key="item.id" class="history-card">
          <view class="history-head">
            <text>{{ (item.video && item.video.name) || "练习视频" }}</text>
            <text class="score">{{ item.scoreAverage }}分</text>
          </view>
          <text class="meta">{{ item.createdAt }} · {{ item.sourceLabel || item.source }}</text>
          <view v-for="score in item.scores" :key="score.name" class="mini">
            <text>{{ score.name }}</text>
            <view class="bar"><view :style="{ width: score.value + '%' }" /></view>
            <text>{{ score.value }}</text>
          </view>
          <TagList :tags="item.tags" />
        </view>
      </view>
      <EmptyState
        v-else
        title="还没有测评记录"
        description="完成一次视频自测后，这里会展示你的能力趋势。"
      />
    </template>
    <template v-else>
      <text class="section">用户列表</text>
      <AdminUserRow v-for="item in users" :key="item._id" :user="item" @select="selectUser" />
      <EmptyState
        v-if="!users.length"
        title="暂无用户"
        description="用户完成登录并同步资料后会出现在这里。"
      />
    </template>
    <view v-if="selectedUser" class="mask" @tap="selectedUser = null">
      <view class="detail" @tap.stop>
        <text class="detail-title">用户资料</text>
        <text class="detail-avatar">{{ (selectedUser.nickname || "友").slice(0, 1) }}</text>
        <text class="detail-name">{{ selectedUser.nickname }}</text>
        <text class="line">地区：{{ selectedUser.region || "未填写" }}</text>
        <text class="line">水平：{{ selectedUser.level || "待测评" }}</text>
        <text class="line">常用时段：{{ selectedUser.availability || "未填写" }}</text>
        <TagList :tags="selectedUser.tags" />
      </view>
    </view>
  </view>
</template>
<script setup>
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTopbar from "../../components/AppTopbar.vue";
import TrendStat from "../../components/TrendStat.vue";
import AdminUserRow from "../../components/AdminUserRow.vue";
import EmptyState from "../../components/EmptyState.vue";
import TagList from "../../components/TagList.vue";
import { requireLogin } from "../../utils/auth";
import { currentSession } from "../../utils/auth";
import { loadReportHistory, clearSession } from "../../utils/storage";
import { callCloud } from "../../utils/cloud";
const role = ref("user"),
  source = ref("本地演示数据"),
  history = ref([]),
  users = ref([]),
  selectedUser = ref(null),
  stats = ref({ count: 0, average: 0, latest: 0 });
onShow(() => {
  if (!requireLogin()) return;
  role.value = currentSession()?.role || "user";
  role.value === "admin" ? loadUsers() : loadHistory();
});
function loadHistory() {
  callCloud("listHistory", {})
    .then((r) => setHistory(r.history || [], "云端数据"))
    .catch(() => setHistory(loadReportHistory(), "本地演示数据"));
}
function setHistory(items, s) {
  history.value = items.map((x) => ({
    ...x,
    scoreAverage:
      x.scoreAverage ||
      Math.round(
        (x.scores || []).reduce((a, b) => a + Number(b.value || 0), 0) /
          Math.max(1, (x.scores || []).length)
      ),
  }));
  source.value = s;
  const values = history.value.map((x) => x.scoreAverage);
  stats.value = {
    count: history.value.length,
    average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
    latest: values[0] || 0,
  };
}
function loadUsers() {
  callCloud("adminListUsers", {})
    .then((r) => {
      if (r.ok === false) throw new Error(r.code);
      users.value = (r.users || []).map((x) => ({
        ...x,
        roleLabel: x.role === "admin" ? "管理员" : "普通用户",
      }));
      source.value = "云端数据";
    })
    .catch(() => {
      users.value = [
        {
          _id: "demo-1",
          nickname: "小林同学",
          region: "洪山区",
          level: "入门至初级",
          tags: ["高远球稳定", "步法待提升"],
          roleLabel: "普通用户",
        },
        {
          _id: "demo-2",
          nickname: "阿杰",
          region: "武昌区",
          level: "初级",
          tags: ["双打默契", "网前积极"],
          roleLabel: "普通用户",
        },
      ];
      source.value = "本地演示数据";
    });
}
function selectUser(user) {
  selectedUser.value = user;
  callCloud("adminGetUser", { userId: user._id })
    .then((r) => {
      if (r.ok !== false) selectedUser.value = r.user || user;
    })
    .catch(() => {});
}
function logout() {
  clearSession();
  uni.redirectTo({ url: "/pages/login/login" });
}
</script>
<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: 50rpx;
}
.topline {
  height: 80rpx;
  padding: 0 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  color: #929292;
  font-size: 23rpx;
}
.logout {
  color: #576b95;
}
.source {
  margin: 22rpx 24rpx 0;
  padding: 16rpx 20rpx;
  border-radius: 10rpx;
  color: #607067;
  background: #f5faf7;
  font-size: 23rpx;
}
.section {
  display: block;
  padding: 30rpx 32rpx 16rpx;
  color: #888;
  font-size: 25rpx;
}
.history {
  margin: 0 24rpx;
}
.history-card {
  margin-bottom: 18rpx;
  padding: 24rpx;
  border-radius: 14rpx;
  background: #fff;
}
.history-head {
  display: flex;
  justify-content: space-between;
  font-size: 29rpx;
}
.score {
  color: #07c160;
  font-weight: 600;
}
.meta {
  display: block;
  margin-top: 9rpx;
  color: #999;
  font-size: 22rpx;
}
.mini {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
  color: #666;
  font-size: 22rpx;
}
.mini > text:first-child {
  width: 125rpx;
}
.mini > text:last-child {
  width: 48rpx;
  text-align: right;
  color: #07c160;
}
.bar {
  flex: 1;
  height: 10rpx;
  border-radius: 8rpx;
  background: #eee;
  overflow: hidden;
}
.bar view {
  height: 100%;
  background: #07c160;
}
.mask {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.42);
  z-index: 10;
}
.detail {
  width: 100%;
  box-sizing: border-box;
  padding: 30rpx 32rpx 52rpx;
  border-radius: 24rpx 24rpx 0 0;
  background: #fff;
}
.detail-title,
.detail-name,
.line {
  display: block;
}
.detail-title {
  font-size: 32rpx;
  font-weight: 600;
}
.detail-avatar {
  display: block;
  margin: 26rpx auto 14rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  line-height: 100rpx;
  text-align: center;
  color: #fff;
  background: #07c160;
  font-size: 42rpx;
}
.detail-name {
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
}
.line {
  margin-top: 18rpx;
  color: #666;
  font-size: 26rpx;
}
</style>

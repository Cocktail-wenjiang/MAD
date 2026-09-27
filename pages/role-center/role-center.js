const app = getApp();
const { loadReportHistory } = require("../../utils/storage");
const { callCloud } = require("../../utils/cloud");
const { redirectToLogin } = require("../../utils/session");

Page({
  data: {
    role: "user",
    roleTitle: "测评趋势",
    history: [],
    stats: null,
    users: [],
    selectedUser: null,
    loading: false,
    error: "",
    source: "本地演示数据",
  },

  onShow() {
    if (!redirectToLogin()) return;
    const role = app.globalData.session.role;
    this.setData({
      role,
      roleTitle: role === "admin" ? "用户管理" : "测评趋势",
      error: "",
      selectedUser: null,
    });
    role === "admin" ? this.loadUsers() : this.loadHistory();
  },

  loadHistory() {
    this.setData({ loading: true });
    callCloud("listHistory", {})
      .then((result) => {
        if (result && result.ok === false) throw new Error(result.code || "history-unavailable");
        const history = Array.isArray(result.history) ? result.history : [];
        this.setHistory(history, "云端数据");
      })
      .catch(() => this.setHistory(loadReportHistory(), "本地演示数据"));
  },

  setHistory(history, source) {
    const items = history.map((item) => ({
      ...item,
      scoreAverage:
        item.scoreAverage ||
        Math.round(
          (item.scores || []).reduce((sum, score) => sum + Number(score.value || 0), 0) /
            Math.max(1, (item.scores || []).length)
        ),
    }));
    const values = items.map((item) => item.scoreAverage).filter((value) => Number.isFinite(value));
    const latest = items[0];
    this.setData({
      history: items,
      source,
      loading: false,
      stats: {
        count: items.length,
        average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
        latest: latest ? latest.scoreAverage : 0,
      },
    });
  },

  loadUsers() {
    this.setData({ loading: true });
    callCloud("adminListUsers", {})
      .then((result) => {
        if (!result || result.ok === false) throw new Error(result && result.code);
        return result;
      })
      .then((result) =>
        this.setData({
          users: (result.users || []).map((item) => ({
            ...item,
            roleLabel: item.role === "admin" ? "管理员" : "普通用户",
          })),
          loading: false,
          source: "云端数据",
        })
      )
      .catch(() =>
        this.setData({
          users: [
            {
              _id: "demo-1",
              nickname: "小林同学",
              region: "洪山区",
              level: "入门至初级",
              tags: ["高远球稳定", "步法待提升"],
              role: "user",
              roleLabel: "普通用户",
            },
            {
              _id: "demo-2",
              nickname: "阿杰",
              region: "武昌区",
              level: "初级",
              tags: ["双打默契", "网前积极"],
              role: "user",
              roleLabel: "普通用户",
            },
          ],
          loading: false,
          source: "本地演示数据",
        })
      );
  },

  selectUser(e) {
    const userId = e.currentTarget.dataset.id;
    const local = this.data.users.find((item) => item._id === userId);
    this.setData({ selectedUser: local || null });
    callCloud("adminGetUser", { userId })
      .then((result) => {
        if (!result || result.ok === false) throw new Error(result && result.code);
        return result;
      })
      .then((result) => this.setData({ selectedUser: result.user || local }))
      .catch(() => null);
  },

  closeDetail() {
    this.setData({ selectedUser: null });
  },

  noop() {},

  logout() {
    app.globalData.session = null;
    wx.removeStorageSync("badminton_friend_session");
    wx.redirectTo({ url: "/pages/login/login" });
  },
});

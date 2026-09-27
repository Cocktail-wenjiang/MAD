const app = getApp();
const { callCloud } = require("../../utils/cloud");
const { redirectToLogin } = require("../../utils/session");
Page({
  data: {
    profile: app.globalData.userProfile,
    banners: [
      {
        id: "local-1",
        title: "同校约球，轻松找到搭子",
        description: "按水平、地区和时间发现合适球友",
      },
      {
        id: "local-2",
        title: "完成自测，记录动作进步",
        description: "用同机位视频对比每次训练趋势",
      },
    ],
    friends: [],
  },
  onShow() {
    if (!redirectToLogin()) return;
    this.setData({ profile: app.globalData.userProfile });
    callCloud("listBanners", {})
      .then((result) => {
        if (result.banners && result.banners.length) this.setData({ banners: result.banners });
      })
      .catch(() => null);
  },
  openFriend(e) {
    const friend = e.detail && e.detail.friend ? e.detail.friend : e.currentTarget.dataset.friend;
    wx.showModal({
      title: friend.nickname,
      content: `${friend.region} · ${friend.availability}\n${friend.tags.join("、")}`,
      confirmText: "发起聊天",
      success: (res) => {
        if (res.confirm) wx.switchTab({ url: "/pages/chat/chat" });
      },
    });
  },
  openProfile() {
    wx.switchTab({ url: "/pages/profile/profile" });
  },
});

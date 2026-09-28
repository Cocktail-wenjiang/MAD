Page({
  data: {
    sessions: [],
    active: null,
    draft: "",
  },
  onShow() {
    const { redirectToLogin } = require("../../utils/session");
    redirectToLogin();
  },
  openSession(e) {
    this.setData({
      active: {
        nickname: e.currentTarget.dataset.item.nickname,
        messages: [],
      },
    });
  },
  backToList() {
    this.setData({ active: null });
  },
  input(e) {
    this.setData({ draft: e.detail.value });
  },
  send() {
    const text = this.data.draft.trim();
    if (!text || !this.data.active) return;
    this.data.active.messages.push({ mine: true, text });
    this.setData({ active: this.data.active, draft: "" });
  },
});

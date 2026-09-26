Page({
  data: { sessions: [{ id: 1, nickname: "小林同学", preview: "周六体育馆见？", time: "昨天", unread: 1 }], active: null, draft: "" },
  onShow() { const { redirectToLogin } = require("../../utils/session"); redirectToLogin() },
  openSession(e) { this.setData({ active: { nickname: e.currentTarget.dataset.item.nickname, messages: [{ mine: false, text: "你好，看到你的标签了！" }, { mine: true, text: "你好，周末一起练球吗？" }, { mine: false, text: "周六体育馆见？" }] } }) },
  backToList() { this.setData({ active: null }) },
  input(e) { this.setData({ draft: e.detail.value }) },
  send() { const text = this.data.draft.trim(); if (!text || !this.data.active) return; this.data.active.messages.push({ mine: true, text }); this.setData({ active: this.data.active, draft: "" }) }
})

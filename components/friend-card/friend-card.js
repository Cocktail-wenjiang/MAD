Component({
  properties: { friend: { type: Object, value: {} } },
  methods: {
    open() {
      this.triggerEvent("open", { friend: this.data.friend });
    },
  },
});

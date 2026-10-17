/* ================= 专注计时引擎（番茄钟） =================
 * 规则：
 * - 同时只允许一个计时；开始新的必须先结束或丢弃当前计时；
 * - 计时状态持久化到 localStorage，刷新/切页面不丢，恢复后继续累计；
 * - 暂停/继续只切换累计状态，不会产生重复时长；
 * - stop() 返回本次时长（分钟），由调用方记入对应事项，引擎不直接写业务数据。 */
"use strict";

const Timer = {
  active: null,   // { itemId, note, startedAt, accumMs, pausedAt }
  _tick: null,

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(TIMER_KEY) || "null");
      if (raw && raw.itemId) this.active = raw;
    } catch (e) { this.active = null; }
    return this.active;
  },

  persist() {
    try {
      if (this.active) localStorage.setItem(TIMER_KEY, JSON.stringify(this.active));
      else localStorage.removeItem(TIMER_KEY);
    } catch (e) { /* 忽略 */ }
  },

  isRunning() { return this.active && !this.active.pausedAt; },
  elapsedMs() {
    if (!this.active) return 0;
    const now = this.active.pausedAt || Date.now();
    return this.active.accumMs + (now - this.active.startedAt);
  },

  start(itemId, note) {
    if (this.active) {
      UI.toast("已有计时在进行，请先结束或丢弃");
      return false;
    }
    this.active = { itemId, note: note || "", startedAt: Date.now(), accumMs: 0, pausedAt: null };
    this.persist();
    this.startTick();
    UI.toast("计时开始");
    return true;
  },

  pause() {
    if (!this.active || this.active.pausedAt) return;
    this.active.accumMs += Date.now() - this.active.startedAt;
    this.active.pausedAt = Date.now();
    this.persist();
    UI.toast("已暂停");
  },

  resume() {
    if (!this.active || !this.active.pausedAt) return;
    this.active.startedAt = Date.now();
    this.active.pausedAt = null;
    this.persist();
    UI.toast("继续计时");
  },

  /* 结束：返回 { itemId, minutes } 并清空计时；不足 1 分钟按 1 分钟计 */
  stop() {
    if (!this.active) return null;
    const minutes = Math.max(1, Math.round(this.elapsedMs() / 60000));
    const result = { itemId: this.active.itemId, minutes };
    this.discard();
    return result;
  },

  discard() {
    this.active = null;
    this.persist();
    this.stopTick();
  },

  startTick() {
    this.stopTick();
    // 只更新学习页的大时钟（无全局浮动条）
    this._tick = setInterval(() => {
      const big = document.getElementById("timerBig");
      if (big) big.textContent = fmtClock(this.elapsedMs() / 1000);
    }, 1000);
  },
  stopTick() {
    clearInterval(this._tick);
    this._tick = null;
  },

  /* 恢复：页面加载时若有持久化计时，重启 tick */
  restore() {
    this.load();
    if (this.active) this.startTick();
  }
};

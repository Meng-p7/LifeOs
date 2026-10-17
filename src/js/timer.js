/* ================= 专注计时引擎 =================
 * 规则：
 * - 同时只允许一个计时；开始新的必须先结束或丢弃当前计时；
 * - 计时状态持久化到 localStorage，刷新/切页面不丢，恢复后继续累计；
 * - 暂停/继续只切换累计状态，不会产生重复时长；
 * - 只有「结束并记录」才写入 study 记录；丢弃则完全作废。 */
"use strict";

const Timer = {
  active: null,   // { subjectId, taskId, note, startedAt, accumMs, pausedAt }
  _tick: null,

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(TIMER_KEY) || "null");
      if (raw && raw.subjectId) this.active = raw;
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

  start(subjectId, taskId, note) {
    if (this.active) {
      UI.toast("已有计时在进行，请先结束或丢弃");
      return false;
    }
    this.active = { subjectId, taskId: taskId || null, note: note || "", startedAt: Date.now(), accumMs: 0, pausedAt: null };
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

  /* 结束并写入学习记录，返回记录 */
  stop() {
    if (!this.active) return null;
    const minutes = Math.max(1, Math.round(this.elapsedMs() / 60000));
    const now = new Date();
    const rec = {
      id: uid(),
      subjectId: this.active.subjectId,
      taskId: this.active.taskId,
      date: dstr(now),
      start: new Date(now.getTime() - minutes * 60000),
      end: now,
      startTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      minutes,
      note: this.active.note || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false
    };
    Store.state.study.push(rec);
    Store.save();
    this.discard();
    UI.toast(`已记录 ${minutes} 分钟`);
    return rec;
  },

  discard() {
    this.active = null;
    this.persist();
    this.stopTick();
  },

  startTick() {
    this.stopTick();
    this._tick = setInterval(() => App.renderTimerBar(), 1000);
    App.renderTimerBar();
  },
  stopTick() {
    clearInterval(this._tick);
    this._tick = null;
    App.renderTimerBar();
  },

  /* 恢复：页面加载时若有持久化计时，重启 tick */
  restore() {
    if (this.active) this.startTick();
  }
};

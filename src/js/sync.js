/* ================= 同步服务 =================
 * 状态机：local（本地模式，未配置云）→ 已登录 → syncing → synced / offline / error / pending
 * 设计原则：
 * - 无 Supabase 配置时永远是 local 状态，UI 如实显示「本地模式」，绝不假装同步成功；
 * - 所有记录带 id / updatedAt / deleted，为按记录合并做准备；
 * - 接入云端只需实现 CloudAdapter 接口并在 init 时注入（见 docs/SUPABASE_SETUP.md）。 */
"use strict";

const Sync = {
  status: "local",          // local | offline | syncing | synced | error | pending
  adapter: null,            // 未来注入 SupabaseAdapter
  lastSyncAt: null,
  lastError: "",
  _dirty: false,

  STATUS_TEXT: {
    local:   { icon: "●", text: "本地模式", tip: "数据仅保存在本机浏览器。配置云同步后可在多设备间同步（见 docs/SUPABASE_SETUP.md）" },
    offline: { icon: "○", text: "离线", tip: "网络不可用，更改已保存到本地，恢复联网后自动重试" },
    syncing: { icon: "◌", text: "同步中", tip: "正在与云端同步…" },
    synced:  { icon: "✓", text: "已同步", tip: "所有更改已同步到云端" },
    error:   { icon: "!", text: "同步失败", tip: "同步出错，可点击重试；本地数据不受影响" },
    pending: { icon: "↑", text: "待同步", tip: "有尚未同步的本地更改" }
  },

  init() {
    // 无 adapter → 本地模式。云端接入时：
    //   Sync.adapter = new SupabaseAdapter({ url, anonKey });
    //   if (Sync.adapter) await Sync.loginIfSession();
    if (!this.adapter) { this.setStatus("local"); return; }
    window.addEventListener("online", () => this.flush());
    window.addEventListener("offline", () => { if (this.adapter) this.setStatus("offline"); });
    if (navigator.onLine === false && this.adapter) this.setStatus("offline");
  },

  setStatus(s, err) {
    this.status = s;
    if (err) this.lastError = err;
    this.renderChip();
  },

  /* 本地发生更改：有 adapter 时标记待同步并触发 flush；无 adapter 时仅记录 */
  markLocalChange() {
    if (!this.adapter) return;
    this._dirty = true;
    if (this.status === "synced") this.setStatus("pending");
    this.scheduleFlush();
  },

  _flushTimer: null,
  scheduleFlush() {
    clearTimeout(this._flushTimer);
    this._flushTimer = setTimeout(() => this.flush(), 1200);
  },

  async flush() {
    if (!this.adapter || !this._dirty) return;
    if (navigator.onLine === false) { this.setStatus("offline"); return; }
    this.setStatus("syncing");
    try {
      await this.adapter.push(Store.state);
      this._dirty = false;
      this.lastSyncAt = Date.now();
      this.setStatus("synced");
    } catch (e) {
      console.warn("[sync] push failed:", e && e.message);
      this.setStatus("error", e && e.message);
    }
  },

  async pull() {
    if (!this.adapter) return;
    this.setStatus("syncing");
    try {
      const remote = await this.adapter.pull();
      const merged = mergeStates(Store.state, remote);
      Store.state = merged;
      Store.save();
      this._dirty = false;
      this.setStatus("synced");
    } catch (e) {
      console.warn("[sync] pull failed:", e && e.message);
      this.setStatus("error", e && e.message);
    }
  },

  async retry() {
    if (!this.adapter) {
      UI.toast("尚未配置云同步：请查看 docs/SUPABASE_SETUP.md 完成部署");
      return;
    }
    await this.flush();
    if (this.status === "error") UI.toast("同步失败：" + (this.lastError || "未知错误") + "，可再次点击重试");
  },

  renderChip() {
    const chip = document.getElementById("syncChip");
    if (!chip) return;
    const s = this.STATUS_TEXT[this.status] || this.STATUS_TEXT.local;
    chip.innerHTML = `<span class="sync-icon ${this.status}" aria-hidden="true">${s.icon}</span><span class="sync-text">${s.text}</span>`;
    chip.title = s.tip;
    chip.setAttribute("aria-label", "数据同步状态：" + s.text);
  }
};

/* ---------- 记录级合并（为跨设备同步准备） ----------
 * 策略：按集合逐条比较 updatedAt，较新者胜；软删除记录保留墓碑，避免已删除项被同步回来；
 * 无 updatedAt 的旧记录视为本地较新。 */
function mergeStates(local, remote) {
  if (!remote || typeof remote !== "object") return local;
  const pick = (a, b) => (b && (b.updatedAt || 0) >= (a && a.updatedAt || 0)) ? b : a;
  const mergeArr = (A = [], B = []) => {
    const map = new Map();
    A.concat(B).forEach(r => {
      if (!r || !r.id) return;
      const ex = map.get(r.id);
      map.set(r.id, ex ? pick(ex, r) : r);
    });
    return Array.from(map.values());
  };
  const mergeDict = (A = {}, B = {}) => {
    const out = { ...A };
    Object.keys(B).forEach(k => {
      const a = out[k], b = B[k];
      if (a && b && typeof a === "object" && !Array.isArray(a)) out[k] = { ...a, ...b, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0) };
      else out[k] = b;
    });
    return out;
  };
  return {
    v: 2,
    settings: { ...local.settings, ...remote.settings, training: { ...local.settings.training, ...(remote.settings && remote.settings.training || {}) } },
    tasks: mergeArr(local.tasks, remote.tasks),
    study: mergeArr(local.study, remote.study),
    blocks: mergeArr(local.blocks, remote.blocks),
    fitness: mergeDict(local.fitness, remote.fitness),
    weight: mergeDict(local.weight, remote.weight),
    diet: mergeDict(local.diet, remote.diet),
    reviews: mergeDict(local.reviews, remote.reviews),
    quotes: local.quotes
  };
}

/* ---------- CloudAdapter 接口约定（实现类需提供） ----------
 * class SupabaseAdapter {
 *   constructor({ url, anonKey }) { ... }
 *   async signUp / signIn / signOut / currentUser()
 *   async push(state)   // 上传本地更改（可实现为按表 upsert）
 *   async pull()        // 拉取远端全量，返回与本地同构的 state
 * }
 * 密钥只允许来自服务端环境变量或部署平台的环境变量注入，禁止写进前端源码。 */

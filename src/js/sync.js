/* ================= 同步服务 =================
 * 状态机：local（本地模式，未配置云）→ 已登录 → syncing → synced / offline / error / pending
 * 设计原则：
 * - 无 Supabase 配置时永远是 local 状态，UI 如实显示「本地模式」，绝不假装同步成功；
 * - 所有记录带 id / updatedAt / deleted，为按记录合并做准备；
 * - 接入云端只需实现 CloudAdapter 接口并在 init 时注入（见 docs/SUPABASE_SETUP.md）。 */
"use strict";

const Sync = {
  status: "local",          // local | loggedout | offline | syncing | synced | error | pending
  adapter: null,            // SupabaseAdapter（配置并登录后注入）
  lastSyncAt: null,
  lastError: "",
  _dirty: false,

  STATUS_TEXT: {
    local:     { icon: "●", text: "本地模式", tip: "数据仅保存在本机浏览器。在「设置」中配置 Supabase 后可多设备同步（docs/SUPABASE_SETUP.md）" },
    loggedout: { icon: "○", text: "未登录", tip: "云同步已配置，登录后自动同步" },
    offline:   { icon: "○", text: "离线", tip: "网络不可用，更改已保存到本地，恢复联网后自动重试" },
    syncing:   { icon: "◌", text: "同步中", tip: "正在与云端同步…" },
    synced:    { icon: "✓", text: "已同步", tip: "所有更改已同步到云端" },
    error:     { icon: "!", text: "同步失败", tip: "同步出错，可点击重试；本地数据不受影响" },
    pending:   { icon: "↑", text: "待同步", tip: "有尚未同步的本地更改" }
  },

  init() {
    // URL 参数一次性注入配置（?sb_url=...&sb_key=...），注入后立即从地址栏清除
    SupabaseConfig.applyFromUrl();
    const cfg = SupabaseConfig.get();
    if (cfg && cfg.url && cfg.key) {
      this.adapter = new SupabaseAdapter(cfg);
      this.restoreSession();
    } else {
      this.setStatus("local");
    }
    if (!this.adapter) return;
    window.addEventListener("online", () => this.flush());
    window.addEventListener("offline", () => { if (this.adapter) this.setStatus("offline"); });
    if (navigator.onLine === false) this.setStatus("offline");
  },

  /* 页面加载时尝试恢复会话并同步 */
  async restoreSession() {
    this.setStatus("syncing");
    try {
      const user = await this.adapter.currentUser();
      if (!user) { this.setStatus("loggedout"); return; }
      await this.adapter.syncAfterLogin();
      this.setStatus("synced");
    } catch (e) {
      console.warn("[sync] restore failed:", e && e.message);
      this.setStatus("error", this.friendlyError(e));
    }
  },

  /* 登录（设置页调用）。注意：登录成功但同步失败（如表未建）时要区分提示 */
  async signIn(email, password) {
    if (!this.adapter) throw new Error("尚未配置云同步");
    this.setStatus("syncing");
    try {
      await this.adapter.signIn(email, password);
    } catch (e) {
      this.setStatus("error", this.friendlyError(e));
      throw e;
    }
    try {
      await this.adapter.syncAfterLogin();
      this.setStatus("synced");
      return true;
    } catch (e) {
      this.setStatus("error", this.friendlyError(e));
      const err = new Error(this.friendlyError(e));
      err.loggedIn = true;   // 已拿到会话，只是同步没成功
      throw err;
    }
  },

  /* 注册（设置页调用；开了邮箱确认时需先收邮件点确认再登录） */
  async signUp(email, password) {
    if (!this.adapter) throw new Error("尚未配置云同步");
    const data = await this.adapter.signUp(email, password);
    if (data && data.access_token) {
      await this.adapter.syncAfterLogin();
      this.setStatus("synced");
    }
    return data;
  },

  async signOut() {
    if (!this.adapter) return;
    await this.adapter.signOut();
    this.setStatus("loggedout");
    this._dirty = false;
  },

  setStatus(s, err) {
    this.status = s;
    if (err) this.lastError = err;
    this.renderChip();
  },

  /* 云端错误的人话提示 */
  friendlyError(e) {
    const msg = (e && e.message) || "";
    const code = e && e.code;
    if (code === "NETWORK" || /Failed to fetch|NetworkError|Load failed|无法连接服务器/.test(msg)) {
      return "无法连接 Supabase 服务器。最常见原因：免费项目 7 天无活动被自动暂停（暂停后域名失效）。请打开 supabase.com/dashboard 查看项目是否显示 Paused，点 Restore 恢复后重试。";
    }
    if (/连接超时/.test(msg)) {
      return "连接超时：服务器无响应，可能是项目已暂停或当前网络无法访问 Supabase。请检查项目状态后重试。";
    }
    if (code === "PGRST205" || /Could not find the table/.test(msg)) {
      return "登录成功，但云端数据表未创建：请在 Supabase 控制台 SQL Editor 执行 docs/SUPABASE_SETUP.md 第 3 节的迁移 SQL。";
    }
    if (/Invalid login credentials/.test(msg)) return "邮箱或密码不正确（若刚注册，请先确认邮箱里的验证邮件）。";
    if (/Email not confirmed/.test(msg)) return "邮箱尚未验证：请打开注册邮箱点击确认链接，再回来登录。";
    if (/User already registered/.test(msg)) return "这个邮箱已注册过，直接点「登录」即可。";
    return msg || "未知错误";
  },

  /* 连接诊断：逐步检查服务器、登录状态、数据表 */
  async diagnose() {
    const cfg = SupabaseConfig.get();
    const out = { configured: !!(cfg && cfg.url && cfg.key), url: cfg ? cfg.url : "", steps: [] };
    if (!out.configured) {
      out.steps.push({ name: "配置", ok: false, msg: "尚未填写 Supabase 地址和密钥" });
      return out;
    }
    const probe = new SupabaseAdapter({ url: cfg.url, key: cfg.key });
    // 1. 服务器连通（不需要登录）
    let t0 = performance.now();
    try {
      await probe.req("/auth/v1/settings");
      out.steps.push({ name: "服务器连通", ok: true, msg: `响应 ${Math.round(performance.now() - t0)} ms` });
    } catch (e) {
      out.steps.push({
        name: "服务器连通", ok: false,
        msg: "无法访问该地址：域名解析失败或项目已暂停。请打开 supabase.com/dashboard 检查项目状态（Paused → Restore）。"
      });
      return out;
    }
    // 2. 登录状态
    let user = null;
    try { user = await probe.currentUser(); } catch (e) { user = null; }
    out.steps.push({ name: "登录状态", ok: !!user, msg: user ? `已登录：${user.email}` : "未登录（需在下方输入邮箱密码）" });
    if (!user) return out;
    // 3. 数据表
    try {
      await probe.req("/rest/v1/tasks?select=id&limit=1", { auth: true });
      out.steps.push({ name: "数据表", ok: true, msg: "云端表可读写" });
    } catch (e) {
      out.steps.push({
        name: "数据表", ok: false,
        msg: e.code === "PGRST205" ? "云端表未创建，请执行迁移 SQL（docs/SUPABASE_SETUP.md 第 3 节）" : this.friendlyError(e)
      });
    }
    return out;
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
      this.setStatus("error", this.friendlyError(e));
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
    if (!this.adapter) { UI.toast("尚未配置云同步：在「设置」中填写 Supabase 地址和密钥"); return; }
    let user = null;
    try { user = await this.adapter.currentUser(); } catch (e) { user = null; }
    if (!user) { this.setStatus("loggedout"); UI.toast("登录状态已失效，请在设置中重新登录"); return; }
    await this.flush();
    if (this.status === "error") UI.toast("同步失败：" + this.friendlyError({ message: this.lastError }) + "，可再次点击重试");
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
    study: normalizeStudy((remote.study && (remote.study.updatedAt || 0) >= (local.study && local.study.updatedAt || 0)) ? remote.study : local.study),
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

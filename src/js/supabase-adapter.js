/* ================= Supabase 云同步适配器 =================
 * 零依赖实现 CloudAdapter 接口（src/js/sync.js 末尾的约定）：
 *   - 认证：/auth/v1（邮箱密码，会话持久化，access_token 自动刷新）
 *   - 数据：/rest/v1（按表 upsert / select，RLS 保证用户隔离）
 * 凭据来源（按优先级）：URL 参数一次性注入 > localStorage 配置（App 内表单填写）。
 * publishable key 是设计上前端可用的公开客户端密钥，数据隔离由 RLS 强制；
 * service_role key 严禁出现在任何前端代码中。 */
"use strict";

const SupabaseConfig = {
  KEY: "lifeos.supabase.config",      // {url, key}
  SESSION_KEY: "lifeos.supabase.session", // {access_token, refresh_token, expires_at, email}

  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || "null"); } catch (e) { return null; }
  },
  save(cfg) { localStorage.setItem(this.KEY, JSON.stringify(cfg)); },
  clear() { localStorage.removeItem(this.KEY); },

  /* URL 参数一次性注入：?sb_url=...&sb_key=... （注入后从地址栏清除，避免留在历史记录） */
  applyFromUrl() {
    try {
      const p = new URLSearchParams(location.search);
      const url = p.get("sb_url"), key = p.get("sb_key");
      if (url && key) {
        this.save({ url: url.replace(/\/+$/, ""), key });
        history.replaceState(null, "", location.pathname + location.hash);
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  },

  getSession() {
    try { return JSON.parse(localStorage.getItem(this.SESSION_KEY) || "null"); } catch (e) { return null; }
  },
  saveSession(s) {
    if (s) localStorage.setItem(this.SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(this.SESSION_KEY);
  }
};

class SupabaseAdapter {
  constructor({ url, key }) {
    this.url = url.replace(/\/+$/, "");
    this.key = key;
    this.user = null;   // {id, email}
  }

  /* ---------- 内部：请求 ---------- */
  async req(path, { method = "GET", body, auth = false, headers = {} } = {}) {
    const h = { "apikey": this.key, "Content-Type": "application/json", ...headers };
    if (auth) {
      const token = await this.validToken();
      h["Authorization"] = "Bearer " + token;
    }
    const res = await fetch(this.url + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401 && auth) {
      // token 可能失效：尝试刷新一次再重试
      await this.refresh(true);
      const t2 = await this.validToken();
      const res2 = await fetch(this.url + path, { method, headers: { ...h, Authorization: "Bearer " + t2 }, body: body ? JSON.stringify(body) : undefined });
      return this.parse(res2);
    }
    return this.parse(res);
  }

  async parse(res) {
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = (data && data.message) || (data && data.msg) || (data && data.error_description) || ("HTTP " + res.status);
      const err = new Error(msg);
      err.code = (data && data.code) || String(res.status);
      throw err;
    }
    return data;
  }

  /* ---------- 认证 ---------- */
  async validToken() {
    const s = SupabaseConfig.getSession();
    if (!s) throw new Error("未登录");
    if (s.expires_at && s.expires_at < Date.now() / 1000 + 60) await this.refresh();
    const s2 = SupabaseConfig.getSession();
    return s2.access_token;
  }

  async refresh(force = false) {
    const s = SupabaseConfig.getSession();
    if (!s || !s.refresh_token) throw new Error("会话已过期，请重新登录");
    if (!force && s.expires_at && s.expires_at >= Date.now() / 1000 + 60) return;
    const data = await this.req("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", body: { refresh_token: s.refresh_token }
    });
    this._saveAuth(data);
  }

  _saveAuth(data) {
    if (!data || !data.access_token) throw new Error((data && data.msg) || "登录失败");
    SupabaseConfig.saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || (Date.now() / 1000 + (data.expires_in || 3600)),
      email: (data.user && data.user.email) || ""
    });
    this.user = data.user ? { id: data.user.id, email: data.user.email } : this.user;
  }

  async signUp(email, password) {
    const data = await this.req("/auth/v1/signup", { method: "POST", body: { email, password } });
    // 开了邮箱确认时不会返回 session
    if (data && data.access_token) this._saveAuth(data);
    return data;
  }

  async signIn(email, password) {
    const data = await this.req("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
    this._saveAuth(data);
    return data;
  }

  async signOut() {
    try { await this.req("/auth/v1/logout", { method: "POST", auth: true }); } catch (e) { /* 忽略 */ }
    SupabaseConfig.saveSession(null);
    this.user = null;
  }

  async currentUser() {
    const s = SupabaseConfig.getSession();
    if (!s) return null;
    try {
      const u = await this.req("/auth/v1/user", { auth: true });
      this.user = { id: u.id, email: u.email };
      return this.user;
    } catch (e) {
      SupabaseConfig.saveSession(null);
      return null;
    }
  }

  /* ---------- 数据：拉取 ---------- */
  async pull() {
    const h = {};
    const [tasks, study, blocks, diet, fitness, weight, reviews, settings] = await Promise.all([
      this.req("/rest/v1/tasks?select=*", { auth: true, headers: h }),
      this.req("/rest/v1/study_records?select=*", { auth: true, headers: h }),
      this.req("/rest/v1/blocks?select=*", { auth: true, headers: h }),
      this.req("/rest/v1/diet_entries?select=*", { auth: true, headers: h }),
      this.req("/rest/v1/fitness_days?select=*", { auth: true, headers: h }),
      this.req("/rest/v1/weight_entries?select=*", { auth: true, headers: h }),
      this.req("/rest/v1/reviews?select=*", { auth: true, headers: h }),
      this.req("/rest/v1/user_settings?select=*", { auth: true, headers: h })
    ]);
    const ts = v => (v ? new Date(v).getTime() : null);
    const st = defaultState();
    st.tasks = (tasks || []).map(r => ({
      id: r.id, title: r.title || "", subjectId: r.subject_id || null, due: r.due || "",
      priority: r.priority || "normal", estMin: r.est_min || 0, done: !!r.done,
      doneAt: ts(r.done_at), createdAt: ts(r.created_at) || Date.now(), updatedAt: ts(r.updated_at) || Date.now(), deleted: !!r.deleted
    }));
    st.study = (study || []).map(r => ({
      id: r.id, subjectId: r.subject_id || null, taskId: r.task_id || null, date: r.date,
      startTime: r.start_time || "", minutes: r.minutes || 0, note: r.note || "",
      createdAt: ts(r.created_at) || Date.now(), updatedAt: ts(r.updated_at) || Date.now(), deleted: !!r.deleted
    }));
    st.blocks = (blocks || []).map(r => ({
      id: r.id, title: r.title || "", type: r.type || "other", date: r.date,
      start: (r.start || "").slice(0, 5), end: (r.end || "").slice(0, 5), taskId: r.task_id || null,
      done: !!r.done, createdAt: ts(r.created_at) || Date.now(), updatedAt: ts(r.updated_at) || Date.now(), deleted: !!r.deleted
    }));
    st.diet = {};
    (diet || []).forEach(r => {
      if (!st.diet[r.date]) st.diet[r.date] = [];
      st.diet[r.date].push({ id: r.id, meal: r.meal, food: r.food, kcal: r.kcal, note: r.note || "", createdAt: ts(r.created_at) || Date.now(), updatedAt: ts(r.updated_at) || Date.now(), deleted: !!r.deleted });
    });
    st.fitness = {};
    (fitness || []).forEach(r => {
      st.fitness[r.date] = { checks: r.checks || {}, note: r.note || "", rpe: r.rpe || "", updatedAt: ts(r.updated_at) || Date.now() };
    });
    st.weight = {};
    (weight || []).forEach(r => { st.weight[r.date] = parseFloat(r.kg); });
    st.reviews = {};
    (reviews || []).forEach(r => {
      st.reviews[r.key] = { ...(r.data || {}), updatedAt: ts(r.updated_at) || Date.now() };
    });
    st.settings = { ...st.settings, ...(settings && settings[0] && settings[0].data || {}) };
    return st;
  }

  /* ---------- 数据：推送（upsert，软删除记录一并上传作为墓碑） ---------- */
  async push(state) {
    const uid = this.user && this.user.id;
    if (!uid) { await this.currentUser(); if (!this.user) throw new Error("未登录"); }
    const me = this.user.id;
    const iso = v => (v ? new Date(v).toISOString() : new Date().toISOString());
    const upsert = (table, rows) => this.req("/rest/v1/" + table, {
      method: "POST",
      auth: true,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: rows
    });
    await Promise.all([
      state.tasks.length && upsert("tasks", state.tasks.map(t => ({
        id: t.id, user_id: me, title: t.title, subject_id: t.subjectId || null, due: t.due || null,
        priority: t.priority || "normal", est_min: t.estMin || 0, done: !!t.done,
        done_at: t.doneAt ? new Date(t.doneAt).toISOString() : null,
        created_at: iso(t.createdAt), updated_at: iso(t.updatedAt), deleted: !!t.deleted
      }))),
      state.study.length && upsert("study_records", state.study.map(r => ({
        id: r.id, user_id: me, subject_id: r.subjectId || null, task_id: r.taskId || null,
        date: r.date, start_time: r.startTime || null, minutes: r.minutes || 0, note: r.note || "",
        created_at: iso(r.createdAt), updated_at: iso(r.updatedAt), deleted: !!r.deleted
      }))),
      state.blocks.length && upsert("blocks", state.blocks.map(b => ({
        id: b.id, user_id: me, title: b.title, type: b.type || "other", date: b.date,
        start: b.start, end: b.end, task_id: b.taskId || null, done: !!b.done,
        created_at: iso(b.createdAt), updated_at: iso(b.updatedAt), deleted: !!b.deleted
      }))),
      Object.keys(state.diet).length && upsert("diet_entries", Object.entries(state.diet).flatMap(([date, items]) =>
        (items || []).map(d => ({
          id: d.id, user_id: me, date, meal: d.meal, food: d.food, kcal: d.kcal || 0, note: d.note || "",
          created_at: iso(d.createdAt), updated_at: iso(d.updatedAt), deleted: !!d.deleted
        })))),
      Object.keys(state.fitness).length && upsert("fitness_days", Object.entries(state.fitness).map(([date, rec]) => ({
        date, user_id: me, checks: rec.checks || {}, note: rec.note || "", rpe: rec.rpe || "", updated_at: iso(rec.updatedAt)
      }))),
      Object.keys(state.weight).length && upsert("weight_entries", Object.entries(state.weight).map(([date, kg]) => ({
        date, user_id: me, kg, updated_at: new Date().toISOString()
      }))),
      Object.keys(state.reviews).length && upsert("reviews", Object.entries(state.reviews).map(([key, data]) => ({
        key, user_id: me, data, updated_at: iso(data.updatedAt)
      }))),
      upsert("user_settings", [{
        user_id: me,
        data: {
          examName: state.settings.examName, examDate: state.settings.examDate,
          dietGoalKcal: state.settings.dietGoalKcal, weightGoal: state.settings.weightGoal,
          training: state.settings.training,
          subjects: state.settings.subjects
        },
        updated_at: new Date().toISOString()
      }])
    ]);
  }

  /* ---------- 首次登录后的合并 ----------
   * 规则：先拉取远端与本地按记录合并（较新者胜），再把合并结果推回云端。
   * 本地有数据、云端为空 → 本地数据上传；云端有、本地空 → 落地；两边都有 → 逐条合并。
   * 全程不会用空数据覆盖任何一侧。 */
  async syncAfterLogin() {
    const remote = await this.pull();
    Store.state = mergeStates(Store.state, remote);
    Store.save();
    await this.push(Store.state);
    Sync.lastSyncAt = Date.now();
  }
}

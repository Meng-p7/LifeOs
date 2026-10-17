/* ================= LifeOs 数据层 =================
 * 模型版本 v2：所有记录带 id / updatedAt / deleted（软删除墓碑），
 * 为跨设备同步与冲突处理做准备。v1 数据自动迁移并先备份。 */
"use strict";

const DB_KEY = "lifeos.v2";
const DB_V1_BACKUP_KEY = "lifeos.v1.backup";
const TIMER_KEY = "lifeos.timer.active";

const DEFAULT_EXERCISES = [
  { id: "pushup", name: "标准俯卧撑", sets: 3, reps: "15 次", part: "胸 · 三头", tip: "核心收紧，身体成一条直线，下放至胸口贴近地面" },
  { id: "press",  name: "单臂哑铃推举", sets: 3, reps: "左右各 10 次", part: "肩", tip: "左手 10 次后立刻换右手 10 次，合计为一组" },
  { id: "row",    name: "单臂哑铃划船", sets: 3, reps: "左右各 10 次", part: "背", tip: "腰背平直，哑铃拉向髋部，挤压背部" },
  { id: "squat",  name: "哑铃深蹲", sets: 3, reps: "15 次", part: "腿 · 臀", tip: "膝盖朝向脚尖方向，蹲至大腿与地面平行" },
  { id: "curl",   name: "哑铃弯举", sets: 3, reps: "12 次", part: "二头", tip: "大臂贴紧身体，不要借力摆动" },
  { id: "plank",  name: "平板支撑", sets: 3, reps: "60 秒", part: "核心", tip: "臀部不塌不翘，自然呼吸" }
];

const MEALS = ["早餐", "午餐", "晚餐", "加餐"];
const BLOCK_TYPES = [
  { id: "class",  name: "课程",   color: "var(--blue)" },
  { id: "study",  name: "学习",   color: "var(--violet)" },
  { id: "fitness",name: "健身",   color: "var(--coral)" },
  { id: "rest",   name: "休息",   color: "var(--green)" },
  { id: "other",  name: "其他",   color: "var(--ink-3)" }
];
const PRIORITIES = { high: "紧急", normal: "普通", low: "低优" };

function defaultState() {
  return {
    v: 2,
    settings: {
      theme: "auto",            // light | dark | auto
      examName: "考研初试",
      examDate: "",             // 为空时首页引导设置，不硬编码历史日期
      dietGoalKcal: 0,
      weightGoal: null,
      training: {
        planDays: [2, 4, 6],
        restSec: 90,
        exercises: DEFAULT_EXERCISES.map(e => ({ ...e }))
      },
      subjects: []
    },
    tasks: [],
    study: defaultStudy(),
    fitness: {},
    weight: {},
    diet: {},
    blocks: [],
    reviews: {},
    quotes: { queue: [], shown: {} }
  };
}

/* 学习模块（极简番茄钟）：用户自建事项 → 逐事项计时 → 按天累计 */
function defaultStudy() {
  return {
    items: [
      { id: "si_word", title: "背单词" },
      { id: "si_math", title: "数学刷题" },
      { id: "si_major", title: "专业课复习" }
    ],
    days: {},          // { "YYYY-MM-DD": { itemId: 分钟 } }
    updatedAt: 0
  };
}
function normalizeStudy(s) {
  const d = defaultStudy();
  if (!s || typeof s !== "object" || Array.isArray(s)) return d;
  return {
    items: Array.isArray(s.items) ? s.items.filter(x => x && x.id && x.title) : d.items,
    days: (s.days && typeof s.days === "object" && !Array.isArray(s.days)) ? s.days : {},
    updatedAt: s.updatedAt || 0
  };
}

/* ---------- v1 → v2 迁移 ---------- */
function migrateV1(raw) {
  if (!raw || typeof raw !== "object") return defaultState();
  // 已经是 v2：补缺省字段（前向兼容）
  if (raw.v === 2) {
    const d = defaultState();
    const merged = { ...d, ...raw };
    merged.settings = { ...d.settings, ...(raw.settings || {}) };
    merged.settings.training = { ...d.settings.training, ...(raw.settings && raw.settings.training || {}) };
    if (!Array.isArray(merged.settings.subjects)) merged.settings.subjects = [];
    merged.tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    merged.study = Array.isArray(raw.study) ? raw.study : [];
    merged.blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
    ["fitness", "weight", "diet", "reviews", "quotes"].forEach(k => {
      if (!merged[k] || typeof merged[k] !== "object") merged[k] = d[k];
    });
    merged.study = normalizeStudy(raw.study);
    return merged;
  }

  // v1：先整包备份，再转换
  try { localStorage.setItem(DB_V1_BACKUP_KEY, JSON.stringify(raw)); } catch (e) { /* 忽略 */ }
  const s = raw.settings || {};
  const subjects = (Array.isArray(s.subjects) ? s.subjects : []).map(name => ({
    id: uid(), name: String(name), weeklyMin: 0, goal: "", note: ""
  }));
  const byName = {};
  subjects.forEach(x => { byName[x.name] = x.id; });
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).map(t => ({
    id: t.id || uid(),
    title: String(t.title || ""),
    subjectId: (t.subject && byName[t.subject]) || null,
    due: t.due || "",
    priority: t.priority || "normal",
    estMin: 0,
    done: !!t.done,
    doneAt: t.doneAt || null,
    createdAt: t.createdAt || Date.now(),
    updatedAt: t.createdAt || Date.now(),
    deleted: false
  }));
  // v1 fitness: {date: {pushup:[..], note}} → v2 {date:{checks:{exId:[..]},note,rpe}}
  const fitness = {};
  Object.entries(raw.fitness || {}).forEach(([d, rec]) => {
    if (!rec || typeof rec !== "object") return;
    const checks = {};
    Object.entries(rec).forEach(([k, v]) => {
      if (Array.isArray(v)) checks[k] = v.slice(); // 动作打卡数组 → checks
    });
    fitness[d] = { checks, note: rec.note || "", rpe: rec.rpe || "", updatedAt: rec.updatedAt || Date.now() };
  });
  return {
    ...defaultState(),
    settings: {
      ...defaultState().settings,
      examName: s.examName || "考研初试",
      examDate: s.examDate || "",
      subjects
    },
    tasks,
    fitness,
    weight: raw.weight && typeof raw.weight === "object" ? raw.weight : {},
    quotes: (raw.quotes && typeof raw.quotes === "object") ? raw.quotes : { queue: [], shown: {} }
  };
}

const Store = {
  state: defaultState(),

  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(DB_KEY) || "null"); } catch (e) { raw = null; }
    // 兼容 v1 旧键
    if (!raw) {
      try { raw = JSON.parse(localStorage.getItem("studyWorkbench.v1") || "null"); } catch (e) { raw = null; }
    }
    this.state = migrateV1(raw);
    if (raw && raw.v !== 2) this.save();
    return this.state;
  },
  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.state));
      Sync.markLocalChange();
    } catch (e) {
      UI.toast("保存失败：浏览器存储空间不足");
    }
  },

  /* ---- 通用记录操作（统一维护 updatedAt） ---- */
  touch(rec) { rec.updatedAt = Date.now(); return rec; },

  /* ---- 科目 ---- */
  subjects() { return this.state.settings.subjects.filter(s => !s.archived); },
  subjectName(id) { const s = this.state.settings.subjects.find(x => x.id === id); return s ? s.name : ""; },

  /* ---- 任务 ---- */
  openTasks() { return this.state.tasks.filter(t => !t.deleted && !t.done); },
  taskById(id) { return this.state.tasks.find(t => t.id === id); },

  /* ---- 学习（番茄钟） ---- */
  studyItems() { return this.state.study.items; },
  studyDay(date) { return this.state.study.days[date] || {}; },
  studyMinutes(date) {
    const d = this.studyDay(date);
    return Object.values(d).reduce((a, b) => a + (b || 0), 0);
  },
  studyMinutesBetween(d0, d1) {
    let sum = 0;
    Object.entries(this.state.study.days).forEach(([date, m]) => {
      if (date >= d0 && date <= d1) sum += Object.values(m || {}).reduce((a, b) => a + (b || 0), 0);
    });
    return sum;
  },
  studyAddMinutes(date, itemId, minutes) {
    if (!this.state.study.days[date]) this.state.study.days[date] = {};
    this.state.study.days[date][itemId] = (this.state.study.days[date][itemId] || 0) + minutes;
    this.state.study.updatedAt = Date.now();
  },

  /* ---- 体重 ---- */
  weightOf(date) { const v = this.state.weight[date]; return (v === undefined || v === null) ? null : v; },
  weight7Avg(dateStr) {
    // 以 dateStr 结尾的 7 个自然日内有记录的平均值（平滑指标）
    const vals = [];
    for (let i = 6; i >= 0; i--) {
      const d = parseDate(dateStr); d.setDate(d.getDate() - i);
      const v = this.weightOf(dstr(d));
      if (v !== null) vals.push(v);
    }
    if (!vals.length) return null;
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  },

  /* ---- 饮食 ---- */
  dietOf(date) { return (this.state.diet[date] || []).filter(d => !d.deleted); },
  dietKcal(date) { return this.dietOf(date).reduce((a, d) => a + (d.kcal || 0), 0); },

  /* ---- 时间块 ---- */
  blocksOf(date) { return this.state.blocks.filter(b => !b.deleted && b.date === date).sort((a, b) => a.start < b.start ? -1 : 1); },
  blocksBetween(d0, d1) { return this.state.blocks.filter(b => !b.deleted && b.date >= d0 && b.date <= d1); },

  /* ---- 复盘 ---- */
  reviewOf(date) { return this.state.reviews[date] || null; }
};

/* ---------- 工具 ---------- */
const pad = n => String(n).padStart(2, "0");
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const todayStr = () => dstr(today());
const parseDate = s => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
const dayDiff = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const WEEK_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const WEEK_SHORT = ["日", "一", "二", "三", "四", "五", "六"];
const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60 ? (m % 60) + " 分" : ""}` : `${m} 分钟`);
const fmtClock = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const PRIORITY_LABEL = p => PRIORITIES[p] || "普通";
const BLOCK_TYPE_LABEL = t => { const b = BLOCK_TYPES.find(x => x.id === t); return b ? b.name : "其他"; };

/* 本周范围（周一为第一天） */
function weekRange(anyDate) {
  const t = anyDate || today();
  const dow = (t.getDay() + 6) % 7;
  const mon = new Date(t); mon.setDate(t.getDate() - dow);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [dstr(mon), dstr(sun)];
}
/* 相对日期描述 */
function fmtDue(s) {
  const diff = dayDiff(todayStr(), s);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === -1) return "昨天";
  if (diff < 0) return `逾期 ${-diff} 天`;
  if (diff <= 7) return `${diff} 天后`;
  const d = parseDate(s); return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function dueCls(s, done) {
  if (done || !s) return "";
  const diff = dayDiff(todayStr(), s);
  if (diff < 0) return "over";
  if (diff === 0) return "today";
  return "";
}
/* 按科目分组统计任务 */
function taskStatsBySubject() {
  const map = {};
  Store.state.tasks.filter(t => !t.deleted).forEach(t => {
    const k = t.subjectId || "__none";
    if (!map[k]) map[k] = { done: 0, total: 0 };
    map[k].total++; if (t.done) map[k].done++;
  });
  return map;
}

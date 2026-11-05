/* ================= 视图：今日（仪表盘） =================
 * 只负责展示：所有数字均来自 Store 的真实记录，无演示数据。
 * 按钮沿用既有的 App.switchView / TasksView.startTimerForTask，不改写数据模型。 */
"use strict";

const TodayView = {
  render() {
    const el = document.getElementById("view-today");
    const t = today();
    const ts = todayStr();
    const hour = new Date().getHours();
    const greet = hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

    el.innerHTML = "";
    el.append(
      this.heroSection(greet, t, ts),
      this.nextActionCard(ts),
      this.dashGrid(ts)
    );
    this.fillSummary(ts);
  },

  /* 顶部问候：叠在雪山横幅上；徽标是真实统计，副标题是固定问候语 */
  heroSection(greet, t, ts) {
    return UI.h("div", { class: "dash-hero" },
      UI.h("div", { class: "hero-left" },
        UI.h("div", { class: "hi" }, `${greet}，孟想`, UI.h("span", { class: "wave", "aria-hidden": "true" }, "👋")),
        UI.h("div", { class: "sub" }, "今天也要加油呀，向着目标前进！"),
        UI.h("div", { class: "hero-badge" },
          UI.h("span", { id: "todaySummary" }, "正在整理今日数据…"))),
      UI.h("div", { class: "hero-date" },
        `${t.getMonth() + 1} 月 ${t.getDate()} 日`, UI.h("br"), `${WEEK_CN[t.getDay()]}`)
    );
  },

  fillSummary(ts) {
    const summary = document.getElementById("todaySummary");
    if (!summary) return;
    const open = Store.openTasks();
    const overdue = open.filter(x => x.due && dayDiff(ts, x.due) < 0);
    const parts = [`待完成 ${open.length} 项`];
    if (overdue.length) parts.push(`逾期 ${overdue.length} 项`);
    parts.push("向着目标前进");
    summary.textContent = parts.join(" · ");
  },

  /* 下一步：优先正在计时 → 逾期 → 今天到期 → 最高优先级 → 引导学习
   * 逻辑与原版一致，仅作为细条展示，不占仪表盘视觉重量 */
  nextActionCard(ts) {
    const pri = { high: 0, normal: 1, low: 2 };
    const byPri = (a, b) => (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1);

    if (Timer.active) {
      const item = Store.studyItems().find(x => x.id === Timer.active.itemId);
      return UI.h("div", { class: "next-action" },
        UI.h("div", { class: "na-label" }, "正在计时"),
        UI.h("div", { class: "na-body" },
          UI.h("div", { class: "na-title" }, item ? item.title : "计时中"),
          UI.h("div", { class: "na-sub" }, Timer.isRunning() ? "计时进行中，保持专注" : "已暂停")),
        UI.h("div", { class: "na-ops" },
          UI.h("button", { class: "btn small primary", type: "button", onclick: () => App.switchView("study") }, "回到计时")));
    }

    const open = Store.openTasks();
    const overdue = open.filter(t => t.due && dayDiff(ts, t.due) < 0).sort(byPri);
    const dueToday = open.filter(t => t.due === ts).sort(byPri);
    const pool = overdue.length ? overdue : (dueToday.length ? dueToday : open.slice().sort(byPri));

    if (!pool.length) {
      return UI.h("div", { class: "next-action" },
        UI.h("div", { class: "na-label" }, "下一步"),
        UI.h("div", { class: "na-body" },
          UI.h("div", { class: "na-title" }, "今天没有待办"),
          UI.h("div", { class: "na-sub" }, "去学习页挑一件事，开始一段计时")),
        UI.h("div", { class: "na-ops" },
          UI.h("button", { class: "btn small primary", type: "button", onclick: () => App.switchView("study") }, "开始学习")));
    }

    const t = pool[0];
    const tagText = t.due && dayDiff(ts, t.due) < 0 ? `逾期 ${-dayDiff(ts, t.due)} 天` : t.due === ts ? "今天到期" : PRIORITY_LABEL(t.priority);
    const tagCls = !t.due ? "" : dayDiff(ts, t.due) < 0 ? "over" : "today";
    return UI.h("div", { class: "next-action" },
      UI.h("div", { class: "na-label" }, "下一步"),
      UI.h("div", { class: "na-body" },
        UI.h("div", { class: "na-title" }, t.title),
        UI.h("div", { class: "na-sub" },
          UI.h("span", { class: "tag tag-due " + tagCls }, tagText),
          t.spentMin ? UI.h("span", { style: "margin-left:6px" }, `已投入 ${fmtMin(t.spentMin)}`) : null)),
      UI.h("div", { class: "na-ops" },
        UI.h("button", { class: "btn small primary", type: "button", onclick: () => TasksView.startTimerForTask(t) }, "开始计时"),
        UI.h("button", { class: "btn small", type: "button", onclick: () => { t.done = true; t.doneAt = Date.now(); Store.touch(t); Store.save(); TodayView.render(); TasksView.renderCounts(); UI.toast(t.spentMin ? `完成 ✓ 累计投入 ${fmtMin(t.spentMin)}` : "完成一项 ✓"); } }, "完成")));
  },

  /* 仪表盘网格：第一行 4+2，第二行 2+2+2，第三行 3+3，底部数据条 */
  dashGrid(ts) {
    const grid = UI.h("div", { class: "dash-grid" });
    grid.append(
      this.focusCard(ts),
      this.examCard(ts),
      this.studyCard(ts),
      this.weightCard(ts),
      this.weekStudyCard(ts),
      this.timelineCard(ts),
      this.quickCard(ts),
      this.miniStatsCard(ts)
    );
    return grid;
  },

  /* 今日重点（4 列） */
  focusCard(ts) {
    const open = Store.openTasks();
    const dueToday = open.filter(x => x.due === ts);
    const pri = { high: 0, normal: 1, low: 2 };
    const focus = open.slice().sort((a, b) => {
      const ao = a.due && dayDiff(ts, a.due) < 0 ? 1 : 0, bo = b.due && dayDiff(ts, b.due) < 0 ? 1 : 0;
      if (ao !== bo) return bo - ao;
      if (a.due !== b.due) return a.due ? (b.due ? (a.due < b.due ? -1 : 1) : -1) : 1;
      return pri[a.priority] - pri[b.priority];
    }).slice(0, 2);
    const doneToday = Store.state.tasks.filter(x => x.done && x.doneAt && dstr(new Date(x.doneAt)) === ts).length;
    const totalToday = doneToday + dueToday.length;
    const rate = totalToday ? Math.round(doneToday / totalToday * 100) : 0;

    const card = UI.h("div", { class: "card span4" },
      UI.h("div", { class: "card-title" },
        icoEl("star"), "今日重点", UI.h("span", { class: "go" }, "›"),
        UI.h("span", { class: "extra" }, `今日已完成 ${doneToday}/${totalToday} · ${rate}%`)));
    const body = UI.h("div", { class: "card-body" });
    const list = UI.h("div", { class: "focus-list" });
    if (focus.length) focus.forEach(task => list.append(TasksView.taskRow(task, { compact: true })));
    else list.append(UI.empty("今日无待办任务", "去「任务」页添加，或给自己留一段自由时间"));
    body.append(list);

    const foot = UI.h("div", { class: "card-foot" },
      UI.h("div", { class: "focus-tip" },
        UI.h("span", { class: "dot" }),
        focus.length ? `建议：先完成「${focus[0].title}」` : "建议：先挑一件最重要的事"),
      UI.h("button", { class: "btn pill", type: "button", onclick: () => App.switchView("study") }, "开始学习 →"));
    card.append(body, foot);
    return card;
  },

  /* 考研倒计时（2 列） */
  examCard(ts) {
    const s = Store.state.settings;
    const card = UI.h("div", { class: "card span2" },
      UI.h("div", { class: "card-title" }, icoEl("cap"), "考研倒计时", UI.h("span", { class: "go" }, "›")));
    const body = UI.h("div", { class: "card-body" });
    const row = UI.h("div", { class: "metric-row" });
    if (!s.examDate) {
      row.append(
        UI.h("div", {},
          UI.h("div", { class: "metric" }, "—", UI.h("small", {}, "天")),
          UI.h("div", { class: "metric-sub" }, "尚未设置考试日期")),
        miniRing(0, "未设置考试日期"));
      body.append(row, UI.h("div", { class: "card-foot" },
        UI.h("span", { class: "hint" }, "在「设置」填写后自动计算"),
        UI.h("button", { class: "btn pill", type: "button", onclick: () => App.switchView("settings") }, "去设置 →")));
    } else {
      const diff = dayDiff(ts, s.examDate);
      const start = parseDate(s.examDate); start.setMonth(start.getMonth() - 4);
      const total = Math.max(1, dayDiff(dstr(start), s.examDate));
      const pct = diff > 0 ? Math.min(100, Math.max(2, Math.round((total - diff) / total * 100))) : 100;
      row.append(
        UI.h("div", {},
          UI.h("div", { class: "metric" }, String(Math.max(0, diff)), UI.h("small", {}, "天")),
          UI.h("div", { class: "metric-sub" }, "加油，未来可期！")),
        miniRing(pct, "备考进程"));
      body.append(row, UI.h("div", { class: "card-foot" },
        UI.h("span", { class: "hint" }, `${s.examName || "考试"} · ${s.examDate.replace(/-/g, "/")}`),
        UI.h("span", { class: "badge-goal" }, `进程 ${pct}%`)));
    }
    card.append(body);
    return card;
  },

  /* 学习计时（2 列）：今日真实专注时长 */
  studyCard(ts) {
    const min = Store.studyMinutes(ts);
    const hhmm = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    const running = !!Timer.active;
    const card = UI.h("div", { class: "card span2" },
      UI.h("div", { class: "card-title" }, icoEl("play"), "学习计时", UI.h("span", { class: "go" }, "›")));
    const body = UI.h("div", { class: "card-body" },
      UI.h("div", { class: "metric" }, hhmm),
      UI.h("div", { class: "metric-sub" }, running ? "时:分 · 正在计时，今日累计专注" : "时:分 · 今日累计专注，番茄钟 25 分钟"),
      UI.h("div", { class: "card-foot" },
        UI.h("span", { class: "hint" }, `本周 ${(Store.studyMinutesBetween(...weekRange()) / 60).toFixed(1)} h`),
        UI.h("button", { class: "btn soft", type: "button", onclick: () => App.switchView("study") }, "开始专注")));
    // 玻璃球装饰（纯视觉，不承载数据）
    const orb = UI.h("div", { "aria-hidden": "true", style: "position:absolute;right:-16px;bottom:-34px;width:104px;height:104px;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.92),rgba(120,165,255,.42) 46%,rgba(47,109,246,.04) 72%);pointer-events:none" });
    card.append(orb, body);
    return card;
  },

  /* 健身与增重（2 列）：真实体重 + 真实趋势 + 本周训练完成度 */
  weightCard(ts) {
    const w = Store.weightOf(ts);
    const y = new Date(parseDate(ts)); y.setDate(y.getDate() - 1);
    const prev = Store.weightOf(dstr(y));
    const delta = (w !== null && prev !== null) ? +(w - prev).toFixed(1) : null;
    const goal = Store.state.settings.weightGoal;
    const [w0, w1] = weekRange();
    const weekFit = Object.keys(Store.state.fitness).filter(d => d >= w0 && d <= w1).length;
    const plan = (Store.state.settings.training.planDays || []).length;
    const pct = plan ? Math.min(100, Math.round(weekFit / plan * 100)) : 0;

    const card = UI.h("div", { class: "card span2" },
      UI.h("div", { class: "card-title" }, icoEl("dumbbell"), "健身与增重", UI.h("span", { class: "go" }, "›")));
    const body = UI.h("div", { class: "card-body" });
    const row = UI.h("div", { class: "metric-row" },
      UI.h("div", {},
        UI.h("div", { class: "metric" }, w === null ? "—" : String(w), UI.h("small", {}, "kg")),
        UI.h("div", { class: "metric-sub" },
          delta === null ? "记录两天后可看变化" : "较昨日",
          delta === null ? null : UI.h("span", { class: "trend" + (delta > 0 ? "" : delta < 0 ? " down" : " flat"), style: "margin-left:6px" }, `${delta > 0 ? "+" : ""}${delta}`))),
      miniRing(pct, "本周训练"));
    body.append(row);
    const spark = sparkline(ts);
    if (spark) body.append(spark);
    else body.append(UI.h("div", { class: "hint", style: "margin-top:auto;padding-top:14px" }, "暂无连续体重记录，去健身页记一次"));
    body.append(UI.h("div", { class: "card-foot" },
      UI.h("span", { class: "badge-goal" }, goal ? `目标 ${goal} kg` : "目标未设置"),
      UI.h("button", { class: "btn small", type: "button", onclick: () => App.switchView("fitness") }, "去记录 →")));
    card.append(body);
    return card;
  },

  /* 本周学习时长（2 列）：本周 7 天真实计时柱状图 */
  weekStudyCard(ts) {
    const [w0] = weekRange();
    const mon = parseDate(w0);
    const dow = (today().getDay() + 6) % 7;
    let cur = 0, prev = 0;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      const v = Store.studyMinutes(dstr(d));
      days.push({ date: dstr(d), value: v, label: WEEK_SHORT[(i + 1) % 7], today: i === dow });
      if (i <= dow) cur += v;
      const p = new Date(mon); p.setDate(mon.getDate() + i - 7);
      if (i <= dow) prev += Store.studyMinutes(dstr(p));
    }
    const pct = prev > 0 ? Math.round((cur - prev) / prev * 100) : null;
    const trend = pct === null ? "— 上周同期无记录" : `${pct >= 0 ? "▲ +" : "▼ "}${pct}% 较上周同期`;

    const card = UI.h("div", { class: "card span2" },
      UI.h("div", { class: "card-title" }, icoEl("bars"), "本周学习时长", UI.h("span", { class: "go" }, "›")));
    card.append(
      UI.h("div", { class: "metric-row" },
        UI.h("div", { class: "metric" }, (cur / 60).toFixed(1), UI.h("small", {}, "h")),
        UI.h("span", { class: "trend" + (pct !== null && pct < 0 ? " down" : " flat"), style: "font-size:10.5px" }, trend)),
      weekBars(days),
      UI.h("div", { class: "card-foot", style: "padding-top:6px" },
        UI.h("span", { class: "hint" }, "数据来自专注计时"),
        UI.h("button", { class: "btn small", type: "button", onclick: () => App.switchView("study") }, "去学习 →")));
    return card;
  },

  /* 今日时间轴（3 列）：时间块 / 今日任务 / 今日学习记录，均为真实数据 */
  timelineCard(ts) {
    const card = UI.h("div", { class: "card span3" },
      UI.h("div", { class: "card-title" }, icoEl("clock"), "今日时间轴",
        UI.h("span", { class: "extra" }, UI.h("button", { class: "btn small ghost", type: "button", style: "min-height:24px;padding:2px 6px;font-size:11px;box-shadow:none", onclick: () => App.switchView("tasks") }, "查看全部 →"))));
    const list = UI.h("div", { class: "timeline" });
    const rows = [];

    // 1. 已保存的时间块（v1 老数据 / 云同步数据）
    Store.blocksOf(ts).forEach(b => {
      const start = b.start || "", end = b.end || "";
      rows.push({
        time: start ? (end ? `${start} – ${end}` : start) : "今天",
        name: b.title || b.name || "未命名安排",
        sub: b.type ? BLOCK_TYPE_LABEL(b.type) : "安排"
      });
    });
    // 2. 今日到期任务
    if (rows.length < 4) {
      Store.openTasks().filter(x => x.due === ts).slice(0, 4 - rows.length).forEach(x => {
        rows.push({ time: "今天到期", name: x.title, sub: PRIORITY_LABEL(x.priority) });
      });
    }
    // 3. 今日有计时记录的学习事项
    if (rows.length < 4) {
      const rec = Store.studyDay(ts);
      Object.keys(rec).filter(k => rec[k] > 0).slice(0, 4 - rows.length).forEach(k => {
        const it = Store.studyItems().find(s => s.id === k);
        rows.push({ time: "已专注", name: it ? it.title : "学习事项", sub: `${rec[k]} 分钟` });
      });
    }

    if (!rows.length) {
      // 明确标注为操作引导，不冒充任何已发生的记录
      list.append(UI.h("div", { class: "hint", style: "padding:2px 0 6px" }, "今天还没有安排记录，可以这样开始："));
      [
        { time: "待办", name: "添加一条今日到期的任务", sub: "任务页 · 回车快速添加" },
        { time: "专注", name: "开始一次 25 分钟计时", sub: "学习页 · 自动累计时长" },
        { time: "记录", name: "记一次体重或训练", sub: "健身页 · 生成真实趋势" }
      ].forEach(r => list.append(UI.h("div", { class: "tl-row tip" },
        UI.h("span", { class: "tl-dot" }),
        UI.h("span", { class: "tl-time" }, r.time),
        UI.h("span", { class: "tl-main" },
          UI.h("div", { class: "tl-name" }, r.name),
          UI.h("div", { class: "tl-sub" }, r.sub)))));
    } else {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      rows.slice(0, 4).forEach((r, i) => {
        const inNow = /^\d{2}:\d{2}/.test(r.time) && (() => {
          const [a, b] = r.time.split("–").map(x => x.trim());
          const toM = s => { const [h, m] = (s || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
          return nowMin >= toM(a) && (b ? nowMin <= toM(b) : nowMin <= toM(a) + 60);
        })();
        list.append(UI.h("div", { class: "tl-row" + (inNow ? " now" : "") },
          UI.h("span", { class: "tl-dot" }),
          UI.h("span", { class: "tl-time" }, r.time),
          UI.h("span", { class: "tl-main" },
            UI.h("div", { class: "tl-name" }, r.name),
            UI.h("div", { class: "tl-sub" }, r.sub))));
      });
    }
    card.append(list);
    return card;
  },

  /* 快速入口 + 激励卡（3 列） */
  quickCard(ts) {
    const card = UI.h("div", { class: "card span3" },
      UI.h("div", { class: "card-title" }, icoEl("grid"), "快速入口", UI.h("span", { class: "go" }, "›")));
    const items = [
      { view: "study", label: "学习", cls: "book", path: '<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2V5z"/><path d="M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2V5z"/>' },
      { view: "fitness", label: "健身", cls: "fit", path: '<path d="M6.5 6.5h11v11h-11z"/><path d="M2 9v6M22 9v6M6.5 2v4M17.5 2v4M6.5 18v4M17.5 18v4"/>' },
      { view: "tasks", label: "任务", cls: "cal", path: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>' },
      { view: "settings", label: "设置", cls: "chart", path: '<path d="M4 20V12M10 20V6M16 20v-6M22 20H2"/>' }
    ];
    const grid = UI.h("div", { class: "quick-grid" });
    items.forEach(it => {
      const iconWrap = UI.h("span", { class: "qi " + it.cls, "aria-hidden": "true" });
      iconWrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${it.path}</svg>`;
      grid.append(UI.h("button", { class: "quick", type: "button", "aria-label": it.label, onclick: () => App.switchView(it.view) },
        iconWrap, UI.h("span", { class: "qt" }, it.label)));
    });
    const quote = UI.h("button", { class: "quote-card", type: "button", style: "width:100%;text-align:left", onclick: () => App.switchView("study") },
      UI.h("span", { class: "q-txt" }, "坚持下去，", UI.h("br"), "你会看到更远的风景"),
      UI.h("span", { class: "q-go", "aria-hidden": "true" }, "→"));
    card.append(grid, quote);
    return card;
  },

  /* 底部真实数据条 */
  miniStatsCard(ts) {
    const [w0, w1] = weekRange();
    const weekFit = Object.keys(Store.state.fitness).filter(d => d >= w0 && d <= w1).length;
    const w = Store.weightOf(ts);
    const card = UI.h("div", { class: "card span6", style: "padding:10px 16px" });
    const row = UI.h("div", { class: "mini-stats" });
    const cell = (v, k, cls) => UI.h("button", { class: "ms", type: "button", onclick: () => App.switchView(cls === "coral" || cls === "violet" ? "fitness" : cls === "blue" ? "study" : "tasks") },
      UI.h("b", { class: cls }, String(v)), UI.h("span", {}, k));
    row.append(
      cell(fmtMin(Store.studyMinutes(ts)), "今日学习", "blue"),
      cell(`${doneRateWeek()}%`, "本周任务完成率", "green"),
      cell(w === null ? "—" : `${w} kg`, "当前体重", "coral"),
      cell(`${weekFit} 次`, "本周训练", "violet"));
    card.append(row, UI.h("div", { class: "chart-note" }, "以上数字均来自你的真实记录：学习时长来自计时，训练次数来自打卡，体重来自每日录入。"));
    return card;
  }
};

/* ---------- 今日视图专用：纯展示型小组件（只读 Store，不写数据） ---------- */
const DASH_ICONS = {
  star: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z"/>',
  cap: '<path d="M2 8l10-4 10 4-10 4-10-4z"/><path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4V8z"/>',
  dumbbell: '<path d="M6.5 6.5h11v11h-11z"/><path d="M2 9v6M22 9v6M6.5 2v4M17.5 2v4M6.5 18v4M17.5 18v4"/>',
  bars: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'
};
function icoEl(name) {
  const s = UI.h("span", { class: "ico", "aria-hidden": "true" });
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DASH_ICONS[name] || DASH_ICONS.grid}</svg>`;
  return s;
}
function svgEl(w, h, content, cls, label, stretch) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${h}`);
  s.setAttribute("role", "img");
  if (stretch) s.setAttribute("preserveAspectRatio", "none");
  if (label) s.setAttribute("aria-label", label);
  if (cls) s.setAttribute("class", cls);
  s.innerHTML = content;
  return s;
}
function miniRing(pct, label) {
  const r = 25, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const content = `<circle cx="31" cy="31" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>
    <circle cx="31" cy="31" r="${r}" fill="none" stroke="var(--blue)" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 31 31)"/>
    <text x="31" y="32" text-anchor="middle" dominant-baseline="middle" font-size="15" font-weight="800" fill="var(--ink)" font-family="var(--font)">${pct}%</text>`;
  return svgEl(62, 62, content, "mini-ring", label || `完成度 ${pct}%`);
}
/* 最近 7 天有记录的体重，全部来自 Store.state.weight */
function sparkline(ts) {
  const pts = [];
  for (let i = 6; i >= 0; i--) {
    const d = parseDate(ts); d.setDate(d.getDate() - i);
    const v = Store.weightOf(dstr(d));
    if (v !== null) pts.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: v });
  }
  if (pts.length < 2) return null;
  const vals = pts.map(p => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 0.4) { max += 0.2; min -= 0.2; }
  const W = 240, H = 46, L = 6, R = 6, T = 7, B = 7;
  const xy = pts.map((p, i) => [
    L + (W - L - R) * (i / (pts.length - 1)),
    T + (H - T - B) * (1 - (p.value - min) / (max - min))
  ]);
  const path = "M" + xy.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L");
  const dots = xy.map((p, i) => `<circle class="spark-dot${i === xy.length - 1 ? " last" : ""}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === xy.length - 1 ? 3.6 : 2.8}"><title>${esc(pts[i].label)}：${pts[i].value} kg</title></circle>`).join("");
  const content = `<line class="spark-grid" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
    <path class="spark-line" d="${path}"/>${dots}`;
  return svgEl(W, H, content, "mini-line", "最近体重趋势", true);
}
/* 本周 7 天学习分钟柱状图 */
function weekBars(days) {
  const W = 240, H = 62, T = 7, B = 15;
  const max = Math.max(60, ...days.map(d => d.value));
  const bw = (W - 12) / 7;
  const bars = days.map((d, i) => {
    const h = Math.max(3, (H - T - B) * (d.value / max));
    const x = 6 + i * bw + bw * 0.18;
    const y = H - B - h;
    return `<rect class="mb${d.today ? " today" : ""}${d.value === 0 ? " zero" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="5"><title>周${d.label}：${d.value} 分钟</title></rect>`;
  }).join("");
  const labels = days.map((d, i) => `<text class="ml" x="${(6 + i * bw + bw * 0.5).toFixed(1)}" y="${H - 3}" text-anchor="middle">${d.label}</text>`).join("");
  return svgEl(W, H, bars + labels, "mini-bars", "本周每日学习时长（分钟）", true);
}

function doneRateWeek() {
  const [w0, w1] = weekRange();
  const all = Store.state.tasks.filter(t => !t.deleted && t.createdAt && dstr(new Date(t.createdAt)) >= w0 && dstr(new Date(t.createdAt)) <= w1);
  if (!all.length) return 0;
  const done = all.filter(t => t.done && t.doneAt && dstr(new Date(t.doneAt)) >= w0 && dstr(new Date(t.doneAt)) <= w1).length;
  return Math.round(done / all.length * 100);
}

/* ================= 视图：今日（行动中心） ================= */
"use strict";

const TodayView = {
  render() {
    const el = document.getElementById("view-today");
    const t = today();
    const hour = new Date().getHours();
    const greet = hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
    const ts = todayStr();

    el.innerHTML = "";
    el.append(
      this.heroSection(greet, t),
      this.focusSection(ts),
      this.timelineSection(ts),
      this.statsSection(ts)
    );
    this.renderTimelineInto(el, ts);
    this.fillSummary(ts);
  },

  /* 今日摘要（DOM 挂载后填充） */
  fillSummary(ts) {
    const summary = document.getElementById("todaySummary");
    if (!summary) return;
    const open = Store.openTasks();
    const overdue = open.filter(x => x.due && dayDiff(ts, x.due) > 0);
    const parts = [`待完成 ${open.length} 项`];
    if (overdue.length) parts.push(`逾期 ${overdue.length} 项`);
    summary.textContent = parts.join(" · ");
  },

  /* 4.1 顶部：问候 + 倒计时 + 进度 */
  heroSection(greet, t) {
    const box = UI.h("div", { class: "hero-top" });
    // 问候 + 进度
    const hello = UI.h("div", { class: "card hello" },
      UI.h("div", { class: "greet" }, `${greet}，孟想`),
      UI.h("div", { class: "big" }, `${t.getMonth() + 1} 月 ${t.getDate()} 日 · ${WEEK_CN[t.getDay()]}`),
      UI.h("div", { class: "sub", id: "todaySummary" })
    );
    // 倒计时
    const s = Store.state.settings;
    let cd;
    if (!s.examDate) {
      cd = UI.h("div", { class: "card countdown" },
        UI.h("div", { class: "meta" },
          UI.h("div", { class: "t" }, "考研倒计时未设置"),
          UI.h("div", { class: "d" }, "在「设置」中填写考试名称和日期"),
          UI.h("button", { class: "btn small primary", type: "button", style: "margin-top:10px", onclick: () => App.switchView("settings") }, "去设置"))
      );
    } else {
      const diff = dayDiff(todayStr(), s.examDate);
      const start = new Date(s.examDate); start.setMonth(start.getMonth() - 4);
      const total = Math.max(1, dayDiff(dstr(start), s.examDate));
      const pct = diff > 0 ? Math.min(100, Math.max(2, Math.round((total - diff) / total * 100))) : 100;
      cd = UI.h("div", { class: "card countdown" },
        UI.h("div", { class: "num" }, String(Math.max(0, diff)), UI.h("small", {}, "天")),
        UI.h("div", { class: "meta" },
          UI.h("div", { class: "t" }, s.examName || "考试"),
          UI.h("div", { class: "d" }, s.examDate.replace(/-/g, "/") + (diff > 0 ? ` · 约 ${Math.floor(diff / 7)} 周` : "")),
          UI.h("div", { class: "track" }, UI.h("div", { class: "fill", style: `width:${pct}%` })),
          UI.h("div", { class: "d", style: "margin-top:5px" }, `备考进程 ${pct}%`))
      );
    }
    box.append(hello, cd);
    return box;
  },

  /* 4.2 今日重点 */
  focusSection(ts) {
    const open = Store.openTasks();
    const dueToday = open.filter(x => x.due && dayDiff(ts, x.due) <= 0);
    const overdue = open.filter(x => x.due && dayDiff(ts, x.due) > 0);
    const pri = { high: 0, normal: 1, low: 2 };
    const focus = open.slice().sort((a, b) => {
      const ao = a.due && dayDiff(ts, a.due) > 0 ? 1 : 0, bo = b.due && dayDiff(ts, b.due) > 0 ? 1 : 0;
      if (ao !== bo) return ao - bo;
      if (a.due !== b.due) return a.due ? (b.due ? (a.due < b.due ? -1 : 1) : -1) : 1;
      return pri[a.priority] - pri[b.priority];
    }).slice(0, 3);

    const doneToday = Store.state.tasks.filter(x => x.done && x.doneAt && dstr(new Date(x.doneAt)) === ts).length;
    const totalToday = doneToday + dueToday.length;
    const rate = totalToday ? Math.round(doneToday / totalToday * 100) : 0;

    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar" }), "今日重点",
        UI.h("span", { class: "extra" }, `今日已完成 ${doneToday}/${totalToday} · ${rate}%`))
    );

    // 完成率环 + 重点任务
    const grid = UI.h("div", { class: "grid2-13" });
    const ringBox = UI.h("div", { class: "chart-box", style: "display:flex;flex-direction:column;align-items:center;gap:8px" },
      Charts.ring(rate, { label: "今日完成率" }),
      UI.h("div", { style: "font-size:12px;color:var(--ink-3);text-align:center;line-height:1.7" },
        `待完成 ${dueToday.length} 项`, UI.h("br"),
        overdue.length ? `逾期 ${overdue.length} 项` : "无逾期任务")
    );
    const listBox = UI.h("div");
    if (focus.length) {
      focus.forEach(task => listBox.append(TasksView.taskRow(task, { compact: true })));
    } else {
      listBox.append(UI.empty("今日无待办任务", "去「任务」页添加，或享受一个自由安排的晚上", UI.h("button", { class: "btn small", type: "button", onclick: () => App.switchView("tasks") }, "去添加任务")));
    }
    grid.append(listBox, ringBox);
    card.append(grid);
    return card;
  },

  /* 4.3 今日时间轴 */
  timelineSection(ts) {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--violet)" }), "今日时间轴",
        UI.h("span", { class: "extra" },
          UI.h("button", { class: "btn small", type: "button", onclick: () => App.switchView("schedule") }, "完整日程 →")))
    );
    const wrap = UI.h("div", { id: "todayTimeline", class: "timeline" });
    card.append(wrap);
    return card;
  },

  renderTimelineInto(root, ts) {
    const wrap = root.querySelector("#todayTimeline");
    if (!wrap) return;
    const blocks = Store.blocksOf(ts);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    wrap.innerHTML = "";
    if (!blocks.length) {
      wrap.append(UI.empty("今天还没有安排时间块", "在「日程」里添加课程、学习或健身时间块", UI.h("button", { class: "btn small", type: "button", onclick: () => App.switchView("schedule") }, "去安排")));
      return;
    }
    // 当前时间线
    const first = blocks[0];
    if (nowMin > toMin(first.start)) {
      wrap.append(UI.h("div", { class: "tl-nowline" }, UI.h("span", {}, `${pad(Math.floor(nowMin / 60))}:${pad(nowMin % 60)} 现在`)));
    }
    blocks.forEach(b => {
      const startM = toMin(b.start), endM = toMin(b.end);
      const done = b.done;
      const now = nowMin >= startM && nowMin < endM;
      const missed = !done && endM < nowMin;
      const item = UI.h("div", { class: `tl-item ${done ? "done" : now ? "now" : missed ? "missed" : ""}` },
        UI.h("span", { class: "time" }, b.start),
        UI.h("span", { class: "dot" }),
        UI.h("div", { class: "body" },
          UI.h("div", { class: "title" },
            done ? UI.h("s", {}, b.title) : UI.h("span", {}, b.title),
            UI.h("span", { class: `tag tag-type-${b.type}` }, BLOCK_TYPE_LABEL(b.type))),
          UI.h("div", { class: "sub" }, `${b.start}–${b.end}${b.taskId ? " · 关联任务" : ""}`)),
        UI.h("div", { class: "ops" },
          !done ? UI.h("button", { class: "mini-btn", type: "button", title: "标记完成", "aria-label": "标记完成", onclick: () => { b.done = true; Store.touch(b); Store.save(); TodayView.render(); UI.toast("已完成"); } },
            UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.4", "stroke-linecap": "round" }, UI.h("polyline", { points: "20 6 9 17 4 12" }))) : null,
          UI.h("button", { class: "mini-btn", type: "button", title: "编辑", "aria-label": "编辑时间块", onclick: () => ScheduleView.editBlock(b) },
            UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"}))))
      );
      wrap.append(item);
    });
  },

  /* 4.4 核心数据概览 */
  statsSection(ts) {
    const [w0, w1] = weekRange();
    const weekStudy = Store.studyMinutesBetween(w0, w1);
    const weekFit = Object.keys(Store.state.fitness).filter(d => d >= w0 && d <= w1).length;
    const w = Store.weightOf(ts);
    const avg7 = Store.weight7Avg(ts);
    const weekDone = Store.state.tasks.filter(x => x.done && x.doneAt && dstr(new Date(x.doneAt)) >= w0 && dstr(new Date(x.doneAt)) <= w1).length;

    const goStudy = () => App.switchView("study");
    const goFit = () => App.switchView("fitness");
    const goReview = () => App.switchView("review");

    return UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--green)" }), "核心数据"),
      UI.h("div", { class: "stat-row" },
        UI.stat({ value: fmtMin(Store.studyMinutes(ts)), label: "今日学习", onClick: goStudy, sub: `本周 ${(weekStudy / 60).toFixed(1)} 小时` }),
        UI.stat({ value: `${doneRateWeek()}%`, label: "本周任务完成率", color: "green", sub: `完成 ${weekDone} 项` }),
        UI.stat({ value: w === null ? "—" : `${w} kg`, label: "当前体重", color: "coral", sub: avg7 === null ? "暂无 7 日均值" : `7 日均值 ${avg7} kg`, onClick: goFit }),
        UI.stat({ value: `${weekFit} 次`, label: "本周训练", color: "violet", sub: `计划 ${Store.state.settings.training.planDays.length} 次/周`, onClick: goFit }),
        UI.stat({ value: Store.reviewOf(ts) ? "已写" : "未写", label: "今日复盘", color: Store.reviewOf(ts) ? "green" : "amber", onClick: goReview })
      ),
      UI.h("div", { class: "chart-note" }, "以上数字均来自你的真实记录：学习时长来自计时，训练次数来自打卡，体重来自每日录入。")
    );
  }
};

function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function doneRateWeek() {
  const [w0, w1] = weekRange();
  const all = Store.state.tasks.filter(t => !t.deleted && t.createdAt && dstr(new Date(t.createdAt)) >= w0 && dstr(new Date(t.createdAt)) <= w1);
  if (!all.length) return 0;
  const done = all.filter(t => t.done && t.doneAt && dstr(new Date(t.doneAt)) >= w0 && dstr(new Date(t.doneAt)) <= w1).length;
  return Math.round(done / all.length * 100);
}

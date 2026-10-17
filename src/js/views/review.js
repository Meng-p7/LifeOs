/* ================= 视图：复盘 ================= */
"use strict";

const ReviewView = {
  render() {
    const el = document.getElementById("view-review");
    el.innerHTML = "";
    el.append(
      this.dailyCard(),
      this.weeklyCard(),
      this.historyCard()
    );
  },

  /* ---- 每日复盘 ---- */
  dailyCard() {
    const ts = todayStr();
    const rec = Store.reviewOf(ts) || {};
    const studyMin = Store.studyMinutes(ts);
    const fitRec = Store.state.fitness[ts];
    const plan = Store.state.settings.training;
    let fitTxt = "未训练";
    if (fitRec) {
      const total = plan.exercises.reduce((a, e) => a + e.sets, 0);
      const done = plan.exercises.reduce((a, e) => a + ((fitRec.checks && fitRec.checks[e.id] || []).filter(Boolean).length), 0);
      fitTxt = `训练 ${done}/${total} 组${fitRec.rpe ? ` · RPE ${fitRec.rpe}` : ""}`;
    }
    const doneTasks = Store.state.tasks.filter(t => t.done && t.doneAt && dstr(new Date(t.doneAt)) === ts);

    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--blue)" }), "今日复盘",
        UI.h("span", { class: "extra" }, `${today().getMonth() + 1}月${today().getDate()}日 ${WEEK_CN[today().getDay()]}`))
    );

    // 自动汇总的真实数据
    card.append(UI.h("div", { class: "chart-box", style: "margin-bottom:14px" },
      UI.h("div", { style: "font-size:13px;font-weight:700;margin-bottom:8px" }, "今日真实数据"),
      UI.h("div", { style: "font-size:13px;line-height:1.9;color:var(--ink-2)" },
        `完成关键任务 ${doneTasks.length} 项${doneTasks.length ? "：" + doneTasks.slice(0, 3).map(t => t.title).join("；") : ""}`, UI.h("br"),
        `实际学习时长：${fmtMin(studyMin)}`, UI.h("br"),
        `训练完成情况：${fitTxt}`, UI.h("br"),
        `今日体重记录：${Store.weightOf(ts) === null ? "未记录" : Store.weightOf(ts) + " kg"}`),
      UI.h("button", { class: "btn small", type: "button", style: "margin-top:8px", onclick: () => this.draftDaily() }, "根据数据生成草稿")));

    const mk = (label, key, ph) => {
      const ta = UI.h("textarea", { placeholder: ph, "data-key": key });
      ta.value = rec[key] || "";
      ta.addEventListener("input", () => {
        clearTimeout(ta._tm);
        ta._tm = setTimeout(() => {
          const ts2 = todayStr();
          if (!Store.state.reviews[ts2]) Store.state.reviews[ts2] = { updatedAt: 0 };
          Store.state.reviews[ts2][key] = ta.value;
          Store.state.reviews[ts2].updatedAt = Date.now();
          Store.save();
        }, 600);
      });
      return UI.h("div", { class: "review-field" }, UI.h("label", {}, label), ta);
    };
    card.append(
      mk("今日进展", "progress", "今天实际推进了什么事？"),
      mk("遇到的问题", "problems", "什么让你卡住或低效？"),
      mk("明日最重要的事", "tomorrow", "明天第一件要解决的事")
    );
    return card;
  },

  /* 根据真实数据生成初稿（可编辑，不覆盖手写内容由用户确认） */
  draftDaily() {
    const ts = todayStr();
    const rec = Store.reviewOf(ts) || {};
    const studyMin = Store.studyMinutes(ts);
    const doneTasks = Store.state.tasks.filter(t => t.done && t.doneAt && dstr(new Date(t.doneAt)) === ts);
    const overdue = Store.openTasks().filter(t => t.due && dayDiff(ts, t.due) > 0);
    const fitRec = Store.state.fitness[ts];
    const progress = [
      doneTasks.length ? `完成任务：${doneTasks.slice(0, 3).map(t => t.title).join("；")}` : "今日无已完成任务",
      studyMin ? `学习 ${fmtMin(studyMin)}` : "今日无学习记录",
      fitRec ? "完成训练打卡" : null,
      Store.weightOf(ts) !== null ? `记录体重 ${Store.weightOf(ts)} kg` : null
    ].filter(Boolean).join("；") + "。";
    const problems = overdue.length ? `有 ${overdue.length} 项任务已逾期，需要重新安排或取舍。` : "（根据数据未发现明显问题，请手动补充）";
    const top = Store.openTasks().sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1)[0];
    const tomorrow = top ? `优先处理：${top.title}${top.due ? `（${fmtDue(top.due)}）` : ""}` : "暂无待办，可主动推进阶段目标";
    UI.modal({
      title: "根据数据生成复盘草稿",
      submitText: "填入表单",
      body: el => el.append(
        UI.h("p", { class: "modal-text", style: "margin-bottom:12px" }, "以下内容根据今日真实记录生成，仅作初稿，你可以在表单中继续修改。"),
        UI.h("div", { class: "review-field" }, UI.h("label", {}, "今日进展"), UI.h("div", { style: "font-size:13px;color:var(--ink-2);white-space:pre-wrap" }, progress)),
        UI.h("div", { class: "review-field" }, UI.h("label", {}, "遇到的问题"), UI.h("div", { style: "font-size:13px;color:var(--ink-2);white-space:pre-wrap" }, problems)),
        UI.h("div", { class: "review-field" }, UI.h("label", {}, "明日最重要的事"), UI.h("div", { style: "font-size:13px;color:var(--ink-2);white-space:pre-wrap" }, tomorrow))),
      onSubmit: () => {
        if (!Store.state.reviews[ts]) Store.state.reviews[ts] = { updatedAt: 0 };
        Store.state.reviews[ts].progress = rec.progress ? rec.progress + "\n" + progress : progress;
        Store.state.reviews[ts].problems = rec.problems ? rec.problems : problems;
        Store.state.reviews[ts].tomorrow = rec.tomorrow ? rec.tomorrow : tomorrow;
        Store.state.reviews[ts].updatedAt = Date.now();
        Store.save(); this.render();
        UI.toast("已填入，可继续编辑");
      }
    });
  },

  /* ---- 每周复盘 ---- */
  weeklyCard() {
    const [w0, w1] = weekRange();
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--violet)" }), "本周复盘",
        UI.h("span", { class: "extra" }, `${w0.slice(5).replace("-", "/")} – ${w1.slice(5).replace("-", "/")}`))
    );
    // 本周真实统计
    const weekStudy = Store.studyMinutesBetween(w0, w1);
    const weekTasks = Store.state.tasks.filter(t => !t.deleted && t.createdAt && dstr(new Date(t.createdAt)) >= w0 && dstr(new Date(t.createdAt)) <= w1);
    const weekDone = Store.state.tasks.filter(t => t.done && t.doneAt && dstr(new Date(t.doneAt)) >= w0 && dstr(new Date(t.doneAt)) <= w1);
    const weekFit = Object.keys(Store.state.fitness).filter(d => d >= w0 && d <= w1).length;
    // 本周各事项学习时长
    const itemMin = {};
    Object.entries(Store.state.study.days).forEach(([date, m]) => {
      if (date >= w0 && date <= w1) Object.entries(m || {}).forEach(([id, v]) => { itemMin[id] = (itemMin[id] || 0) + (v || 0); });
    });
    const subjItems = Store.studyItems().map(it => ({ name: it.title, minutes: itemMin[it.id] || 0 })).filter(x => x.minutes > 0).sort((a, b) => b.minutes - a.minutes);
    // 体重变化
    const wStart = (() => { for (let i = 0; i < 7; i++) { const d = parseDate(w0); d.setDate(d.getDate() + i); const v = Store.weightOf(dstr(d)); if (v !== null) return v; } return null; })();
    const wEnd = (() => { for (let i = 6; i >= 0; i--) { const d = parseDate(w0); d.setDate(d.getDate() + i); const v = Store.weightOf(dstr(d)); if (v !== null) return v; } return null; })();

    card.append(
      UI.h("div", { class: "stat-row", style: "margin-bottom:14px" },
        UI.stat({ value: fmtMin(weekStudy), label: "本周学习", color: "violet" }),
        UI.stat({ value: `${weekDone.length}/${weekTasks.length}`, label: "任务完成", color: "green" }),
        UI.stat({ value: `${weekFit} 次`, label: "本周训练", color: "coral", sub: `计划 ${Store.state.settings.training.planDays.length} 次` }),
        UI.stat({ value: wStart !== null && wEnd !== null ? `${(wEnd - wStart > 0 ? "+" : "")}${(wEnd - wStart).toFixed(1)} kg` : "—", label: "本周体重变化", color: "blue" })),
      subjItems.length ? UI.h("div", { class: "chart-box", style: "margin-bottom:14px" },
        UI.h("div", { style: "font-size:13px;font-weight:700;margin-bottom:8px" }, "各事项学习时长"),
        UI.h("div", { class: "hbars" }, subjItems.map(it => {
          const total = subjItems.reduce((a, b) => a + b.minutes, 0) || 1;
          const pct = Math.round(it.minutes / total * 100);
          return UI.h("div", { class: "hbar-row" },
            UI.h("span", { class: "hbar-name" }, it.name),
            UI.h("span", { class: "hbar-track" }, UI.h("span", { class: "hbar-fill", style: `width:${pct}%` })),
            UI.h("span", { class: "hbar-n" }, `${(it.minutes / 60).toFixed(1)}h`));
        }))) : UI.empty("本周暂无学习记录"),
      UI.h("div", { class: "chart-note", style: "margin-bottom:14px" }, "以上均为本周真实记录汇总。周复盘内容按周独立保存，生成新一周不会覆盖历史。")
    );

    // 周复盘表单（按周 key 存储）
    const wkKey = `W${weekNum(parseDate(w0))}`;
    const rec = Store.state.reviews[wkKey] || {};
    const mk = (label, key, ph) => {
      const ta = UI.h("textarea", { placeholder: ph });
      ta.value = rec[key] || "";
      ta.addEventListener("input", () => {
        clearTimeout(ta._tm);
        ta._tm = setTimeout(() => {
          if (!Store.state.reviews[wkKey]) Store.state.reviews[wkKey] = { updatedAt: 0 };
          Store.state.reviews[wkKey][key] = ta.value;
          Store.state.reviews[wkKey].updatedAt = Date.now();
          Store.save();
        }, 600);
      });
      return UI.h("div", { class: "review-field" }, UI.h("label", {}, label), ta);
    };
    card.append(
      mk("计划与实际执行的差异", "diff", "哪些按计划完成了，哪些没有？差多少？"),
      mk("下周值得调整的事", "adjust", "时间分配、方法、任务量……")
    );
    return card;
  },

  /* ---- 历史复盘 ---- */
  historyCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--green)" }), "历史复盘", UI.h("span", { class: "extra" }, "最近 14 条"))
    );
    const keys = Object.keys(Store.state.reviews).sort().reverse();
    if (!keys.length) {
      card.append(UI.empty("还没有复盘记录", "从今天的复盘开始写"));
      return card;
    }
    keys.slice(0, 14).forEach(k => {
      const r = Store.state.reviews[k];
      const isWeek = k.startsWith("W");
      const dateLabel = isWeek ? `${k} 周复盘` : `${k.slice(5).replace("-", "/")} 日复盘`;
      const parts = [];
      if (r.progress) parts.push(`进展：${r.progress}`);
      if (r.problems) parts.push(`问题：${r.problems}`);
      if (r.tomorrow) parts.push(`明日重点：${r.tomorrow}`);
      if (r.diff) parts.push(`差异：${r.diff}`);
      if (r.adjust) parts.push(`调整：${r.adjust}`);
      card.append(UI.h("div", { class: "review-hist", style: "margin-top:12px" },
        UI.h("div", { class: "rh-head" }, dateLabel),
        parts.length ? parts.map(p => UI.h("div", { class: "rh-item" }, p)) : UI.h("div", { class: "rh-item" }, "（空）")));
    });
    return card;
  }
};

function weekNum(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

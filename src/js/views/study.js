/* ================= 视图：学习 ================= */
"use strict";

const StudyView = {
  render() {
    const el = document.getElementById("view-study");
    el.innerHTML = "";
    el.append(
      this.timerCard(),
      this.subjectsCard(),
      this.statsCard(),
      this.recordsCard()
    );
    // 卡片挂载后再渲染计时框（依赖 DOM）
    this.renderTimerBox();
  },

  /* ---- 专注计时 ---- */
  timerCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--violet)" }), "专注计时", UI.h("span", { class: "extra", id: "timerStateText" }))
    );
    card.append(UI.h("div", { id: "timerBox" }));
    return card;
  },

  renderTimerBox() {
    const box = document.getElementById("timerBox");
    if (!box) return;
    box.innerHTML = "";
    if (Timer.active) {
      const s = Store.subjectName(Timer.active.subjectId);
      const running = Timer.isRunning();
      box.append(
        UI.h("div", { class: "row" },
          UI.h("span", { class: "tag tag-type-study" }, s || "未分类科目"),
          UI.h("span", { style: "font-size:13px;color:var(--ink-2)" }, running ? "计时中…" : "已暂停"),
          UI.h("strong", { style: "font-size:24px;margin-left:auto;font-variant-numeric:tabular-nums", id: "timerBig" }, fmtClock(Timer.elapsedMs() / 1000))),
        UI.h("div", { class: "row", style: "margin-top:10px" },
          UI.h("button", { class: "btn", type: "button", onclick: () => { running ? Timer.pause() : Timer.resume(); this.renderTimerBox(); } }, running ? "暂停" : "继续"),
          UI.h("button", { class: "btn primary", type: "button", onclick: () => { Timer.stop(); this.render(); } }, "结束并记录"),
          UI.h("button", { class: "btn danger", type: "button", onclick: async () => {
            const ok = await UI.confirmDanger("丢弃本次计时", "当前累计的时长将作废，不会写入学习记录。确定丢弃吗？", "丢弃");
            if (!ok) return;
            Timer.discard(); this.renderTimerBox();
          } }, "丢弃"))
      );
      const st = document.getElementById("timerStateText");
      if (st) st.textContent = running ? "进行中" : "已暂停";
      return;
    }
    const subj = UI.select(Store.subjects().map(s => ({ value: s.id, label: s.name })), Store.subjects()[0] && Store.subjects()[0].id, { allLabel: "选择科目" });
    const open = Store.openTasks();
    const task = UI.select([{ value: "", label: "不关联任务" }].concat(open.map(t => ({ value: t.id, label: t.title }))), "");
    const note = UI.input({ placeholder: "学习内容备注（可选）" });
    const start = () => {
      if (!subj.value) { UI.toast("请先选择科目"); return; }
      if (Timer.start(subj.value, task.value, note.value)) { this.render(); App.renderTimerBar(); }
    };
    box.append(
      UI.h("div", { class: "add-row" }, subj, task, note, UI.h("button", { class: "btn primary", type: "button", onclick: start }, "开始计时")),
      UI.h("div", { class: "chart-note" }, "计时会自动保存，刷新页面不丢失；同时只允许一个计时，避免重复累计时长。")
    );
    const st = document.getElementById("timerStateText");
    if (st) st.textContent = "未开始";
  },

  /* ---- 科目管理 ---- */
  subjectsCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--blue)" }), "科目管理",
        UI.h("span", { class: "extra" },
          UI.h("button", { class: "btn small", type: "button", onclick: () => this.editSubject(null) }, "+ 新增科目")))
    );
    const wrap = UI.h("div", { id: "subjectList" });
    card.append(wrap);
    const [w0, w1] = weekRange();
    const weekMin = Store.studyMinutesBetween(w0, w1);
    Store.subjects().forEach(s => {
      // 本周该科目时长
      let sWeek = 0;
      Store.state.study.forEach(r => { if (!r.deleted && r.subjectId === s.id && r.date >= w0 && r.date <= w1) sWeek += r.minutes; });
      const pct = s.weeklyMin ? Math.min(100, Math.round(sWeek / s.weeklyMin * 100)) : 0;
      wrap.append(UI.h("div", { class: "subject-card" },
        UI.h("div", { class: "body" },
          UI.h("div", { class: "name" }, s.name),
          s.goal ? UI.h("div", { class: "goal" }, `阶段目标：${s.goal}`) : (s.note ? UI.h("div", { class: "goal" }, s.note) : null),
          UI.h("div", { class: "prog" },
            UI.h("div", { class: "track" }, UI.h("div", { class: "fill", style: `width:${pct}%` })),
            UI.h("div", { class: "lab" },
              UI.h("span", {}, s.weeklyMin ? `本周 ${fmtMin(sWeek)} / 目标 ${fmtMin(s.weeklyMin)}` : `本周 ${fmtMin(sWeek)}（未设周目标）`),
              UI.h("span", {}, s.weeklyMin ? `${pct}%` : "")))),
        UI.h("div", { class: "ops", style: "display:flex;gap:4px;flex:none" },
          UI.h("button", { class: "mini-btn", type: "button", title: "编辑科目", "aria-label": "编辑科目", onclick: () => this.editSubject(s) },
            UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" }))),
          UI.h("button", { class: "mini-btn danger", type: "button", title: "删除科目", "aria-label": "删除科目", onclick: () => this.removeSubject(s) },
            UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }))))
      ));
    });
    if (!Store.subjects().length) {
      wrap.append(UI.empty("还没有科目", "点击「+ 新增科目」建立你的第一个学习科目"));
    }
    return card;
  },

  editSubject(s) {
    const isNew = !s;
    UI.modal({
      title: isNew ? "新增科目" : "编辑科目",
      submitText: "保存",
      body: (box) => {
        const name = UI.input({ value: s ? s.name : "", placeholder: "例如：机械设计", required: true, maxlength: 12 });
        const goal = UI.input({ value: s ? s.goal : "", placeholder: "例如：期末 90 分 / 完成三轮复习" });
        const wm = UI.input({ type: "number", min: 0, max: 3000, step: 30, value: s && s.weeklyMin ? s.weeklyMin : "", placeholder: "0" });
        const note = UI.input({ value: s ? s.note : "", placeholder: "备注（可选）" });
        box.append(
          UI.field("科目名称", name),
          UI.field("阶段目标", goal, "长期目标，用于复盘对照"),
          UI.field("每周目标时长（分钟）", wm, "例如 900 = 15 小时；0 表示不设目标"),
          UI.field("备注", note)
        );
        box._get = () => ({ name, goal, wm, note });
      },
      onSubmit: (box) => {
        const f = box._get;
        const n = f.name.value.trim();
        if (!n) { UI.toast("科目名称不能为空"); return false; }
        if (Store.subjects().some(x => x.name === n && (!s || x.id !== s.id))) { UI.toast("科目名称已存在"); return false; }
        if (isNew) {
          Store.state.settings.subjects.push({ id: uid(), name: n, weeklyMin: parseInt(f.wm.value || "0", 10) || 0, goal: f.goal.value.trim(), note: f.note.value.trim() });
        } else {
          s.name = n; s.weeklyMin = parseInt(f.wm.value || "0", 10) || 0; s.goal = f.goal.value.trim(); s.note = f.note.value.trim();
        }
        Store.save();
        this.render();
        TasksView.renderCounts();
        UI.toast(isNew ? "科目已创建" : "已保存");
      }
    });
  },

  async removeSubject(s) {
    const used = Store.state.tasks.filter(t => t.subjectId === s.id && !t.deleted).length;
    const recs = Store.state.study.filter(r => r.subjectId === s.id && !r.deleted).length;
    const ok = await UI.confirmDanger("删除科目",
      `确定删除「${s.name}」吗？\n\n影响：${used} 个任务将变为「未分类」，${recs} 条学习记录会保留但失去科目关联。此操作不可撤销。`, "确认删除");
    if (!ok) return;
    Store.state.settings.subjects = Store.state.settings.subjects.filter(x => x.id !== s.id);
    Store.state.tasks.forEach(t => { if (t.subjectId === s.id) { t.subjectId = null; Store.touch(t); } });
    Store.save();
    this.render(); TasksView.renderCounts();
    UI.toast("已删除科目");
  },

  /* ---- 学习统计 ---- */
  statsCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--green)" }), "学习统计", UI.h("span", { class: "extra" }, "最近 14 天"))
    );
    const grid = UI.h("div", { class: "grid2" });

    // 每日时长柱状图
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = today(); d.setDate(d.getDate() - i); days.push(dstr(d)); }
    const chart = Charts.bars({
      items: days.map(d => ({ label: d.slice(5).replace("-", "/"), value: Store.studyMinutes(d), tip: d })),
      unit: " 分钟", label: "最近 14 天每日学习时长"
    });
    const barsBox = UI.h("div", { class: "chart-box" },
      UI.h("div", { style: "font-size:13px;font-weight:700;margin-bottom:8px" }, "每日学习时长（分钟）"),
      chart || UI.empty("暂无学习记录", "开始一次专注计时，或手动补记"),
      UI.h("div", { class: "chart-note" }, "悬停柱子查看具体日期与时长")
    );

    // 科目分布 + 连续天数
    const bySub = {};
    Store.state.study.filter(r => !r.deleted).forEach(r => { bySub[r.subjectId || "__none"] = (bySub[r.subjectId || "__none"] || 0) + r.minutes; });
    const items = Object.entries(bySub).map(([k, v]) => ({ name: k === "__none" ? "未分类" : (Store.subjectName(k) || "已删科目"), minutes: v }))
      .sort((a, b) => b.minutes - a.minutes);
    const totalMin = items.reduce((a, b) => a + b.minutes, 0) || 1;
    const distBox = UI.h("div", { class: "chart-box" },
      UI.h("div", { style: "font-size:13px;font-weight:700;margin-bottom:8px" }, "科目时长分布"),
      items.length ? UI.h("div", { class: "hbars" }, items.map(it => {
        const pct = Math.round(it.minutes / totalMin * 100);
        return UI.h("div", { class: "hbar-row" },
          UI.h("span", { class: "hbar-name" }, it.name),
          UI.h("span", { class: "hbar-track" }, UI.h("span", { class: "hbar-fill", style: `width:${pct}%` })),
          UI.h("span", { class: "hbar-n" }, `${pct}%`));
      })) : UI.empty("暂无数据"),
      UI.h("div", { class: "chart-note" }, `累计 ${fmtMin(totalMin)}`));

    // 连续学习天数
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = today(); d.setDate(d.getDate() - i);
      if (Store.studyMinutes(dstr(d)) > 0) streak++;
      else { if (i === 0) continue; break; }
    }
    const [w0, w1] = weekRange();
    const weekMin = Store.studyMinutesBetween(w0, w1);
    const weekGoal = Store.subjects().reduce((a, s) => a + (s.weeklyMin || 0), 0);
    grid.append(barsBox, distBox);
    card.append(grid,
      UI.h("div", { class: "stat-row", style: "margin-top:14px" },
        UI.stat({ value: `${streak} 天`, label: "连续学习", color: streak > 0 ? "green" : "", sub: "今日未学则中断" }),
        UI.stat({ value: fmtMin(weekMin), label: "本周学习", color: "violet", sub: weekGoal ? `目标 ${fmtMin(weekGoal)}` : "未设总目标" }),
        UI.stat({ value: Store.state.study.filter(r => !r.deleted).length, label: "累计记录", color: "blue", sub: "条学习记录" }))
    );
    return card;
  },

  /* ---- 学习记录 ---- */
  recordsCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--amber)" }), "学习记录",
        UI.h("span", { class: "extra" }, UI.h("button", { class: "btn small", type: "button", onclick: () => this.addRecord() }, "+ 手动补记")))
    );
    const recs = Store.state.study.filter(r => !r.deleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0))).slice(0, 20);
    const list = UI.h("div", {});
    if (!recs.length) {
      list.append(UI.empty("还没有学习记录", "用上面的计时器开始第一段学习"));
    } else {
      recs.forEach(r => {
        const task = r.taskId ? Store.taskById(r.taskId) : null;
        list.append(UI.h("div", { class: "study-rec" },
          UI.h("span", { class: "t" }, r.startTime || "--:--"),
          UI.h("div", { class: "body" },
            UI.h("div", { style: "font-weight:700" }, Store.subjectName(r.subjectId) || "未分类"),
            UI.h("div", { style: "font-size:12px;color:var(--ink-3)" }, [r.date, task ? `关联：${task.title}` : null, r.note].filter(Boolean).join(" · "))),
          UI.h("span", { class: "min" }, `${r.minutes} 分钟`),
          UI.h("button", { class: "mini-btn danger", type: "button", title: "删除记录", "aria-label": "删除学习记录", onclick: async () => {
            const ok = await UI.confirmDanger("删除学习记录", `确定删除 ${r.date} 的 ${r.minutes} 分钟记录吗？`, "删除");
            if (!ok) return;
            r.deleted = true; Store.touch(r); Store.save(); this.render(); UI.toast("已删除");
          } }, UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" })))
        ));
      });
    }
    card.append(list);
    return card;
  },

  addRecord() {
    UI.modal({
      title: "手动补记学习",
      submitText: "保存",
      body: (box) => {
        const date = UI.input({ type: "date", value: todayStr() });
        const start = UI.input({ type: "time", value: "09:00" });
        const end = UI.input({ type: "time", value: "10:30" });
        const subj = UI.select(Store.subjects().map(s => ({ value: s.id, label: s.name })), Store.subjects()[0] && Store.subjects()[0].id, { allLabel: "选择科目" });
        const open = Store.openTasks();
        const task = UI.select([{ value: "", label: "不关联任务" }].concat(open.map(t => ({ value: t.id, label: t.title }))), "");
        const note = UI.input({ placeholder: "学习内容（可选）" });
        box.append(
          UI.field("日期", date), UI.field("开始时间", start), UI.field("结束时间", end),
          UI.field("科目", subj), UI.field("关联任务", task), UI.field("备注", note)
        );
        box._get = () => ({ date, start, end, subj, task, note });
      },
      onSubmit: (box) => {
        const f = box._get;
        const minutes = Math.max(0, toMin(f.end.value) - toMin(f.start.value));
        if (!f.date.value || !f.start.value || !f.end.value) { UI.toast("请填写日期与起止时间"); return false; }
        if (minutes <= 0) { UI.toast("结束时间必须晚于开始时间"); return false; }
        if (!f.subj.value) { UI.toast("请选择科目"); return false; }
        Store.state.study.push({
          id: uid(), subjectId: f.subj.value, taskId: f.task.value || null,
          date: f.date.value, startTime: f.start.value, minutes,
          note: f.note.value.trim(), createdAt: Date.now(), updatedAt: Date.now(), deleted: false
        });
        Store.save(); this.render(); UI.toast(`已记录 ${minutes} 分钟`);
      }
    });
  }
};

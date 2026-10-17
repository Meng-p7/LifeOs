/* ================= 视图：任务 ================= */
"use strict";

const TasksView = {
  filter: "open",
  filterSubj: "",

  render() {
    const el = document.getElementById("view-tasks");
    el.innerHTML = "";
    el.append(this.addCard(), this.listCard());
    this.renderList();
    this.renderCounts();
  },

  addCard() {
    const inp = UI.input({ placeholder: "任务内容，例如：机械设计第三章作业", required: true, maxlength: 80, id: "taskInp" });
    const subj = UI.select(Store.subjects().map(s => ({ value: s.id, label: s.name })), "", { allLabel: "未分类" });
    const due = UI.input({ type: "date", id: "taskDue", value: todayStr() });
    const pri = UI.select([
      { value: "normal", label: "普通" }, { value: "high", label: "紧急" }, { value: "low", label: "低优" }
    ], "normal");
    const est = UI.input({ type: "number", min: 0, max: 600, step: 5, placeholder: "预计分钟", id: "taskEst" });
    est.style.width = "100px";
    const submit = () => {
      const title = inp.value.trim();
      if (!title) { UI.toast("先输入任务内容"); inp.focus(); return; }
      Store.state.tasks.push(Store.touch({
        id: uid(), title, subjectId: subj.value || null, due: due.value || "",
        priority: pri.value, estMin: parseInt(est.value || "0", 10) || 0,
        done: false, doneAt: null, createdAt: Date.now(), deleted: false
      }));
      Store.save();
      inp.value = ""; est.value = "";
      this.render(); this.renderCounts();
      UI.toast("已添加任务");
      inp.focus();
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    return UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar" }), "添加任务", UI.h("span", { class: "extra" }, "回车快速添加")),
      UI.h("div", { class: "add-row" },
        inp, subj, due, pri, est,
        UI.h("button", { class: "btn primary", type: "button", onclick: submit }, "添加"))
    );
  },

  listCard() {
    const card = UI.h("div", { class: "card" });
    const filters = UI.h("div", { class: "filters", id: "taskFilters" },
      ...[
        { f: "open", label: "进行中" }, { f: "today", label: "今天" }, { f: "week", label: "本周" },
        { f: "over", label: "逾期" }, { f: "done", label: "已完成" }, { f: "all", label: "全部" }
      ].map(x => {
        const b = UI.h("button", { class: "chip" + (this.filter === x.f ? " active" : ""), type: "button", "data-f": x.f, "data-label": x.label }, x.label);
        b.addEventListener("click", () => { this.filter = x.f; this.render(); });
        return b;
      }),
      UI.select(
        [{ value: "", label: "全部科目" }].concat(Store.subjects().map(s => ({ value: s.id, label: s.name })), [{ value: "__none", label: "未分类" }]),
        this.filterSubj, {}
      )
    );
    filters.querySelector("select").addEventListener("change", e => { this.filterSubj = e.target.value; this.render(); });
    card.append(UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--coral)" }), "任务列表", UI.h("span", { class: "extra", id: "taskListExtra" })), filters);
    const list = UI.h("div", { class: "task-list", id: "taskList" });
    card.append(list);
    return card;
  },

  renderCounts() {
    const ts = todayStr(), [w0, w1] = weekRange();
    const cnt = f => Store.state.tasks.filter(f).length;
    const nums = {
      open: cnt(t => !t.deleted && !t.done),
      today: cnt(t => !t.deleted && !t.done && t.due && dayDiff(ts, t.due) <= 0),
      week: cnt(t => !t.deleted && !t.done && t.due && t.due >= w0 && t.due <= w1),
      over: cnt(t => !t.deleted && !t.done && t.due && dayDiff(ts, t.due) > 0),
      done: cnt(t => !t.deleted && t.done),
      all: cnt(t => !t.deleted)
    };
    document.querySelectorAll("#taskFilters .chip").forEach(c => {
      const f = c.dataset.f;
      const n = nums[f];
      c.innerHTML = `${esc(c.dataset.label || "")}<span class="n">${n}</span>`;
    });
    // 导航角标：今日待办 + 逾期
    const badge = nums.today + nums.over;
    const navBtn = document.querySelector('.nav-item[data-view="tasks"]');
    let b = navBtn.querySelector(".badge");
    if (badge > 0) {
      if (!b) { b = UI.h("span", { class: "badge" }); navBtn.append(b); }
      b.textContent = badge;
    } else if (b) b.remove();
    const extra = document.getElementById("taskListExtra");
    if (extra) extra.textContent = `共 ${nums.all} 项`;
  },

  renderList() {
    const list = document.getElementById("taskList");
    if (!list) return;
    const ts = todayStr(), [w0, w1] = weekRange();
    let items = Store.state.tasks.filter(t => !t.deleted);
    if (this.filterSubj) items = items.filter(t => this.filterSubj === "__none" ? !t.subjectId : t.subjectId === this.filterSubj);
    if (this.filter === "open") items = items.filter(t => !t.done);
    else if (this.filter === "today") items = items.filter(t => !t.done && t.due && dayDiff(ts, t.due) <= 0);
    else if (this.filter === "week") items = items.filter(t => !t.done && t.due && t.due >= w0 && t.due <= w1);
    else if (this.filter === "over") items = items.filter(t => !t.done && t.due && dayDiff(ts, t.due) > 0);
    else if (this.filter === "done") items = items.filter(t => t.done);
    const pri = { high: 0, normal: 1, low: 2 };
    items.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.done && a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      if (!a.done && a.due !== b.due) return a.due ? -1 : 1;
      if (!a.done && a.priority !== b.priority) return pri[a.priority] - pri[b.priority];
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    list.innerHTML = "";
    if (!items.length) {
      const msg = this.filter === "done" ? "还没有完成的任务" : this.filter === "open" ? "任务全部清空" : "这个筛选下暂无任务";
      list.append(UI.empty(msg, "换个筛选条件，或在上方添加一个任务"));
      return;
    }
    items.forEach(t => list.append(this.taskRow(t)));
  },

  /* 任务行（compact 用于首页今日重点） */
  taskRow(t, { compact = false } = {}) {
    const row = UI.h("div", { class: "task" + (t.done ? " done" : "") },
      UI.h("button", { class: "t-check" + (t.done ? " on" : ""), type: "button", "aria-label": t.done ? "标记为未完成" : "完成任务", onclick: () => this.toggle(t) },
        UI.h("svg", { viewBox: "0 0 24 24" }, UI.h("polyline", { points: "20 6 9 17 4 12" }))),
      UI.h("div", { class: "body" },
        UI.h("div", { class: "t-title" }, t.title),
        UI.h("div", { class: "t-meta" },
          UI.h("span", { class: "tag " + (t.subjectId ? "tag-subject" : "tag-due") }, Store.subjectName(t.subjectId) || "未分类"),
          t.due ? UI.h("span", { class: `tag tag-due ${dueCls(t.due, t.done)}` }, fmtDue(t.due)) : null,
          t.estMin ? UI.h("span", { class: "tag tag-due" }, `预计 ${fmtMin(t.estMin)}`) : null,
          t.done ? UI.h("span", { class: "tag tag-done" }, "已完成") : UI.h("span", { class: "tag tag-due" }, UI.h("i", { class: `pri-dot pri-${t.priority}` }), PRIORITY_LABEL(t.priority)))
      ),
      UI.h("div", { class: "ops" },
        compact ? null : UI.h("button", { class: "mini-btn", type: "button", title: "编辑", "aria-label": "编辑任务", onclick: () => this.edit(t) },
          UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"}))),
        UI.h("button", { class: "mini-btn danger", type: "button", title: "删除", "aria-label": "删除任务", onclick: () => this.remove(t) },
          UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}))))
    );
    return row;
  },

  toggle(t) {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    Store.touch(t);
    Store.save();
    this.render(); this.renderCounts();
    if (App.curView === "today") TodayView.render();
    UI.toast(t.done ? "完成一项 ✓" : "已恢复为进行中");
  },

  async remove(t) {
    const ok = await UI.confirmDanger("删除任务", `确定删除「${t.title}」吗？删除后可在同步场景中通过墓碑机制避免复活，本地将立即移除。`, "确认删除");
    if (!ok) return;
    t.deleted = true; // 软删除，保留墓碑
    Store.touch(t);
    Store.save();
    this.render(); this.renderCounts();
    UI.toast("已删除");
  },

  edit(t) {
    UI.modal({
      title: "编辑任务",
      submitText: "保存",
      body: (box) => {
        const title = UI.input({ value: t.title, required: true });
        const subj = UI.select(Store.subjects().map(s => ({ value: s.id, label: s.name })), t.subjectId || "", { allLabel: "未分类" });
        const due = UI.input({ type: "date", value: t.due || "" });
        const pri = UI.select([{ value: "normal", label: "普通" }, { value: "high", label: "紧急" }, { value: "low", label: "低优" }], t.priority);
        const est = UI.input({ type: "number", min: 0, max: 600, step: 5, value: t.estMin || "" });
        box.append(
          UI.field("任务内容", title),
          UI.field("科目", subj),
          UI.field("截止日期", due, "留空表示无截止日期"),
          UI.field("优先级", pri),
          UI.field("预计时长（分钟）", est, "用于日程规划参考，不影响实际记录")
        );
        box._get = () => ({ title, subj, due, pri, est });
      },
      onSubmit: (box) => {
        const f = box._get;
        if (!f.title.value.trim()) { UI.toast("任务内容不能为空"); return false; }
        t.title = f.title.value.trim();
        t.subjectId = f.subj.value || null;
        t.due = f.due.value;
        t.priority = f.pri.value;
        t.estMin = parseInt(f.est.value || "0", 10) || 0;
        Store.touch(t); Store.save();
        this.render(); this.renderCounts();
        if (App.curView === "today") TodayView.render();
        UI.toast("已保存");
      }
    });
  }
};

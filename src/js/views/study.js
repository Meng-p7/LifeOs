/* ================= 视图：学习（极简番茄钟） =================
 * 用户自建每日事项 → 点开始计时 → 按天累计 → 当日饼图 + 每日统计 */
"use strict";

const ITEM_COLORS = ["var(--blue)", "var(--violet)", "var(--coral)", "var(--green)", "var(--amber)", "#0ea5e9", "#f43f5e", "#8b5cf6"];

const StudyView = {
  render() {
    const el = document.getElementById("view-study");
    if (!el) return;
    el.innerHTML = "";
    el.append(
      this.timerCard(),
      this.itemsCard(),
      this.donutCard(),
      this.dailyCard()
    );
  },

  /* ---- 计时器 ---- */
  timerCard() {
    const card = UI.h("div", { class: "card study-timer" });
    if (!Timer.active) {
      card.append(
        UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--violet)" }), "专注计时"),
        UI.h("div", { class: "timer-idle" },
          UI.h("div", { class: "timer-idle-icon", "aria-hidden": "true" }, "◷"),
          UI.h("div", {}, "在下方「今日事项」中选择一件事，点「开始」即可计时"),
          UI.h("div", { class: "chart-note" }, "计时自动保存，刷新页面不丢失；同时只计一件事"))
      );
      return card;
    }
    const item = Store.studyItems().find(x => x.id === Timer.active.itemId);
    const running = Timer.isRunning();
    card.append(
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--violet)" }), "专注计时",
        UI.h("span", { class: "extra" }, running ? "进行中" : "已暂停")),
      UI.h("div", { class: "timer-running" },
        UI.h("div", { class: "timer-item-name" }, item ? item.title : "已删除的事项"),
        UI.h("div", { class: "timer-big", id: "timerBig" }, fmtClock(Timer.elapsedMs() / 1000)),
        UI.h("div", { class: "timer-ops" },
          UI.h("button", { class: "btn", type: "button", onclick: () => { running ? Timer.pause() : Timer.resume(); this.render(); } }, running ? "暂停" : "继续"),
          UI.h("button", { class: "btn primary", type: "button", onclick: () => this.stopTimer() }, "结束并记录"),
          UI.h("button", { class: "btn danger", type: "button", onclick: () => this.discardTimer() }, "丢弃")))
    );
    return card;
  },

  stopTimer() {
    const r = Timer.stop();
    if (!r) return;
    Store.studyAddMinutes(todayStr(), r.itemId, r.minutes);
    Store.save();
    this.render();
    if (App.curView === "today") TodayView.render();
    UI.toast(`已记录 ${r.minutes} 分钟`);
  },

  async discardTimer() {
    const ok = await UI.confirmDanger("丢弃本次计时", "当前累计的时长将作废，不会记录。确定丢弃吗？", "丢弃");
    if (!ok) return;
    Timer.discard();
    this.render();
  },

  /* ---- 今日事项 ---- */
  itemsCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--blue)" }), "今日事项",
        UI.h("span", { class: "extra" }, "自己设置每天要做的事"))
    );
    const inp = UI.input({ placeholder: "添加事项，例如：英语阅读一篇", maxlength: 30, id: "studyItemInp" });
    const add = () => {
      const v = inp.value.trim();
      if (!v) { UI.toast("先输入事项名称"); return; }
      if (Store.studyItems().some(x => x.title === v)) { UI.toast("事项已存在"); return; }
      Store.state.study.items.push({ id: uid(), title: v });
      Store.state.study.updatedAt = Date.now();
      Store.save();
      inp.value = "";
      this.render();
      UI.toast("已添加");
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") add(); });
    card.append(UI.h("div", { class: "add-row" }, inp, UI.h("button", { class: "btn primary", type: "button", onclick: add }, "添加")));

    const items = Store.studyItems();
    if (!items.length) {
      card.append(UI.empty("还没有事项", "添加今天要做的事，然后点「开始」计时"));
      return card;
    }
    const day = Store.studyDay(todayStr());
    const list = UI.h("div", { class: "study-items" });
    items.forEach((it, i) => {
      const mins = day[it.id] || 0;
      const isActive = Timer.active && Timer.active.itemId === it.id;
      list.append(UI.h("div", { class: "study-item" + (isActive ? " active" : "") },
        UI.h("span", { class: "study-item-dot", style: `background:${ITEM_COLORS[i % ITEM_COLORS.length]}` }),
        UI.h("div", { class: "study-item-body" },
          UI.h("div", { class: "study-item-name" }, it.title),
          UI.h("div", { class: "study-item-mins" }, mins > 0 ? `今日已学 ${fmtMin(mins)}` : "今日未学")),
        UI.h("div", { class: "study-item-ops" },
          UI.h("button", { class: "mini-btn", type: "button", title: "重命名", "aria-label": "重命名事项", onclick: () => this.renameItem(it) },
            UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" }))),
          UI.h("button", { class: "mini-btn danger", type: "button", title: "删除事项", "aria-label": "删除事项", onclick: () => this.removeItem(it) },
            UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }))),
          isActive
            ? UI.h("span", { class: "tag tag-type-study" }, "计时中")
            : UI.h("button", { class: "btn small primary", type: "button", onclick: () => { if (Timer.start(it.id)) this.render(); } }, "开始"))
      ));
    });
    card.append(list);
    return card;
  },

  renameItem(it) {
    UI.modal({
      title: "重命名事项",
      submitText: "保存",
      body: (box) => {
        const name = UI.input({ value: it.title, required: true, maxlength: 30 });
        box.append(UI.field("事项名称", name));
        box._get = () => name;
      },
      onSubmit: (box) => {
        const v = box._get.value.trim();
        if (!v) { UI.toast("名称不能为空"); return false; }
        it.title = v;
        Store.state.study.updatedAt = Date.now();
        Store.save(); this.render();
        UI.toast("已保存");
      }
    });
  },

  async removeItem(it) {
    const used = Object.values(Store.studyDay(todayStr())).length;
    const ok = await UI.confirmDanger("删除事项", `确定删除「${it.title}」吗？历史学习记录会保留但不再显示名称。`, "确认删除");
    if (!ok) return;
    Store.state.study.items = Store.state.study.items.filter(x => x.id !== it.id);
    Store.state.study.updatedAt = Date.now();
    if (Timer.active && Timer.active.itemId === it.id) Timer.discard();
    Store.save();
    this.render();
    UI.toast("已删除");
  },

  /* ---- 当日饼状图 ---- */
  donutCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--coral)" }), "今日时长", UI.h("span", { class: "extra" }, todayStr().slice(5).replace("-", "/")))
    );
    const day = Store.studyDay(todayStr());
    const total = Store.studyMinutes(todayStr());
    if (!total) {
      card.append(UI.empty("今天还没有学习记录", "开始第一次计时，这里就会出现占比图"));
      return card;
    }
    const items = Store.studyItems();
    const segments = items.map((it, i) => ({ name: it.title, value: day[it.id] || 0, color: ITEM_COLORS[i % ITEM_COLORS.length] })).filter(s => s.value > 0);
    const wrap = UI.h("div", { class: "donut-wrap" });
    const chart = Charts.donut({ segments, centerText: fmtMin(total), centerSub: "今日总计" });
    if (chart) wrap.append(chart);
    const legend = UI.h("div", { class: "donut-legend" });
    segments.forEach((s, i) => {
      const pct = Math.round(s.value / total * 100);
      legend.append(UI.h("div", { class: "donut-leg-row" },
        UI.h("span", { class: "donut-leg-dot", style: `background:${ITEM_COLORS[items.findIndex(x => x.title === s.name) % ITEM_COLORS.length]}` }),
        UI.h("span", { class: "donut-leg-name" }, s.name),
        UI.h("span", { class: "donut-leg-val" }, `${fmtMin(s.value)} · ${pct}%`)));
    });
    wrap.append(legend);
    card.append(wrap);
    return card;
  },

  /* ---- 每日统计 ---- */
  dailyCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--green)" }), "每日学习时长", UI.h("span", { class: "extra" }, "最近 14 天"))
    );
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = today(); d.setDate(d.getDate() - i); days.push(dstr(d)); }
    const items = days.map(d => ({ label: d.slice(5).replace("-", "/"), value: Store.studyMinutes(d), tip: d }));
    const hasAny = items.some(x => x.value > 0);
    if (!hasAny) {
      card.append(UI.empty("暂无统计数据", "坚持记录几天，这里会出现每日时长"));
      return card;
    }
    card.append(UI.h("div", { class: "chart-box" }, Charts.bars({ items, unit: " 分钟", label: "最近 14 天每日学习时长" }),
      UI.h("div", { class: "chart-note" }, "悬停柱子查看具体日期与时长")));
    // 近 14 天汇总
    const [w0] = weekRange();
    const weekMin = Store.studyMinutesBetween(w0, todayStr());
    const activeDays = days.filter(d => Store.studyMinutes(d) > 0).length;
    card.append(UI.h("div", { class: "stat-row", style: "margin-top:14px" },
      UI.stat({ value: fmtMin(Store.studyMinutes(todayStr())), label: "今日学习", color: "violet" }),
      UI.stat({ value: fmtMin(weekMin), label: "本周学习", color: "blue" }),
      UI.stat({ value: `${activeDays} 天`, label: "近 14 天学习天数", color: "green" })));
    return card;
  }
};

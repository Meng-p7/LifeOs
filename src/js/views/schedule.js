/* ================= 视图：日程 ================= */
"use strict";

const ScheduleView = {
  mode: "day",        // day | week
  dayOffset: 0,       // 相对今天的天数

  curDate() { const d = today(); d.setDate(d.getDate() + this.dayOffset); return dstr(d); },

  render() {
    const el = document.getElementById("view-schedule");
    el.innerHTML = "";
    el.append(this.toolbar(), this.mode === "day" ? this.dayView() : this.weekView(), this.unscheduledCard());
    if (this.mode === "day") this.renderDayBlocks();
  },

  toolbar() {
    const d = parseDate(this.curDate());
    const label = this.dayOffset === 0 ? "今天" : this.dayOffset === 1 ? "明天" : this.dayOffset === -1 ? "昨天" :
      `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_CN[d.getDay()]}`;
    return UI.h("div", { class: "card" },
      UI.h("div", { class: "row", style: "justify-content:space-between" },
        UI.h("div", { class: "row" },
          UI.h("button", { class: "btn small", type: "button", "aria-label": "前一天", onclick: () => { this.dayOffset--; this.render(); } }, "←"),
          UI.h("strong", { style: "font-size:15px;min-width:110px;text-align:center" }, label),
          UI.h("button", { class: "btn small", type: "button", "aria-label": "后一天", onclick: () => { this.dayOffset++; this.render(); } }, "→"),
          this.dayOffset !== 0 ? UI.h("button", { class: "btn small ghost", type: "button", onclick: () => { this.dayOffset = 0; this.render(); } }, "回到今天") : null),
        UI.h("div", { class: "row" },
          UI.h("button", { class: "chip" + (this.mode === "day" ? " active" : ""), type: "button", onclick: () => { this.mode = "day"; this.render(); } }, "日视图"),
          UI.h("button", { class: "chip" + (this.mode === "week" ? " active" : ""), type: "button", onclick: () => { this.mode = "week"; this.render(); } }, "周视图"),
          UI.h("button", { class: "btn primary small", type: "button", onclick: () => this.editBlock(null) }, "+ 新建时间块"))
      )
    );
  },

  /* ---- 日视图：时间网格 ---- */
  dayView() {
    return UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--blue)" }), "时间安排", UI.h("span", { class: "extra", id: "dayBlockCount" })),
      UI.h("div", { class: "sched-day" }, UI.h("div", { class: "sched-hours", id: "schedHours" }))
    );
  },

  renderDayBlocks() {
    const wrap = document.getElementById("schedHours");
    if (!wrap) return;
    const ds = this.curDate();
    const blocks = Store.blocksOf(ds);
    const count = document.getElementById("dayBlockCount");
    if (count) count.textContent = `${blocks.length} 个时间块`;
    // 小时刻度 6:00 - 24:00
    wrap.innerHTML = "";
    for (let h = 6; h <= 23; h++) {
      wrap.append(UI.h("div", { class: "sched-hour" }, UI.h("span", { class: "lab" }, `${pad(h)}:00`)));
    }
    const conflicts = this.findConflicts(blocks);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const isToday = ds === todayStr();
    blocks.forEach(b => {
      const startM = toMin(b.start), endM = Math.max(toMin(b.end), startM + 15);
      const top = (startM - 6 * 60) / (18 * 60) * 100;
      const height = Math.max(4, (endM - startM) / (18 * 60) * 100);
      const el = UI.h("div", {
        class: `sched-block type-${b.type}` + (b.done ? " done" : ""),
        style: `top:${top}%;height:${height}%`,
        role: "button", tabindex: "0",
        "aria-label": `${b.title}，${b.start} 到 ${b.end}`,
        onclick: () => this.editBlock(b),
        onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.editBlock(b); } }
      },
      UI.h("div", { class: "t" }, b.done ? UI.h("s", {}, b.title) : UI.h("span", {}, b.title), UI.h("span", { class: `tag tag-type-${b.type}` }, BLOCK_TYPE_LABEL(b.type))),
      UI.h("div", { class: "s" }, `${b.start}–${b.end}${isToday && nowMin >= startM && nowMin < endM ? " · 进行中" : ""}`)
      );
      if (conflicts.has(b.id)) {
        el.append(UI.h("span", { class: "conflict-flag", title: "与其他时间块重叠" }, "⚠"));
      }
      wrap.append(el);
    });
  },

  /* 冲突检测：同一时间段重叠 */
  findConflicts(blocks) {
    const set = new Set();
    const sorted = blocks.slice().sort((a, b) => toMin(a.start) - toMin(b.start));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (toMin(sorted[j].start) < toMin(sorted[i].end)) { set.add(sorted[i].id); set.add(sorted[j].id); }
        else break;
      }
    }
    return set;
  },

  /* ---- 周视图 ---- */
  weekView() {
    const [w0, w1] = weekRange();
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--violet)" }), "本周安排",
        UI.h("span", { class: "extra" }, `${w0.slice(5).replace("-", "/")} – ${w1.slice(5).replace("-", "/")}`))
    );
    const grid = UI.h("div", { class: "sched-week" });
    for (let i = 0; i < 7; i++) {
      const d = parseDate(w0); d.setDate(d.getDate() + i);
      const ds = dstr(d);
      const col = UI.h("div", { class: "sched-wcol" + (ds === todayStr() ? " today" : "") },
        UI.h("div", { class: "head" }, `${WEEK_SHORT[d.getDay()]} ${d.getDate()}`));
      const blocks = Store.blocksOf(ds);
      if (!blocks.length) col.append(UI.h("div", { style: "font-size:10.5px;color:var(--ink-3);text-align:center;padding:8px 0" }, "—"));
      blocks.forEach(b => {
        col.append(UI.h("div", {
          class: `sched-wblock type-${b.type}` + (b.done ? " done" : ""),
          role: "button", tabindex: "0", title: `${b.title} ${b.start}–${b.end}（点击编辑）`,
          onclick: () => { this.dayOffset = dayDiff(todayStr(), ds); this.mode = "day"; this.render(); setTimeout(() => this.editBlock(b), 50); },
          onkeydown: e => { if (e.key === "Enter") e.target.click(); }
        },
        UI.h("div", { class: "bt" }, b.title),
        UI.h("div", { class: "bs" }, `${b.start}–${b.end}`)));
      });
      grid.append(col);
    }
    card.append(grid);
    return card;
  },

  /* ---- 未安排任务 ---- */
  unscheduledCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--amber)" }), "未安排时间的任务", UI.h("span", { class: "extra" }, "把任务排进时间轴"))
    );
    const scheduledIds = new Set(Store.state.blocks.filter(b => !b.deleted && b.taskId).map(b => b.taskId));
    const unscheduled = Store.openTasks().filter(t => !scheduledIds.has(t.id));
    if (!unscheduled.length) {
      card.append(UI.empty("所有任务都已安排或暂无待办", "新建任务后可从这里排入日程"));
      return card;
    }
    const list = UI.h("div", { class: "task-list" });
    unscheduled.slice(0, 8).forEach(t => {
      list.append(UI.h("div", { class: "task" },
        UI.h("div", { class: "body" },
          UI.h("div", { class: "t-title" }, t.title),
          UI.h("div", { class: "t-meta" },
            UI.h("span", { class: "tag " + (t.subjectId ? "tag-subject" : "tag-due") }, Store.subjectName(t.subjectId) || "未分类"),
            t.due ? UI.h("span", { class: `tag tag-due ${dueCls(t.due, false)}` }, fmtDue(t.due)) : null,
            t.estMin ? UI.h("span", { class: "tag tag-due" }, `预计 ${fmtMin(t.estMin)}`) : null)),
        UI.h("div", { class: "ops" },
          UI.h("button", { class: "btn small", type: "button", onclick: () => this.editBlock(null, t) }, "安排时间")))
      );
    });
    card.append(list);
    return card;
  },

  /* ---- 新建 / 编辑时间块 ---- */
  editBlock(b, presetTask) {
    const isNew = !b;
    const ds = b ? b.date : this.curDate();
    UI.modal({
      title: isNew ? "新建时间块" : "编辑时间块",
      submitText: "保存",
      body: (box) => {
        const title = UI.input({ value: b ? b.title : (presetTask ? presetTask.title : ""), placeholder: "标题，例如：高数复习", required: true });
        const type = UI.select(BLOCK_TYPES.map(x => ({ value: x.id, label: x.name })), b ? b.type : (presetTask ? "study" : "study"));
        const date = UI.input({ type: "date", value: ds });
        const start = UI.input({ type: "time", value: b ? b.start : "09:00" });
        const end = UI.input({ type: "time", value: b ? b.end : "10:30" });
        const open = Store.openTasks();
        const taskSel = UI.select(
          [{ value: "", label: "不关联任务" }].concat(open.map(t => ({ value: t.id, label: t.title }))),
          b ? (b.taskId || "") : (presetTask ? presetTask.id : "")
        );
        const done = UI.h("input", { type: "checkbox" });
        done.checked = b ? !!b.done : false;
        done.style.width = "18px"; done.style.height = "18px";
        box.append(
          UI.field("标题", title),
          UI.field("类型", type),
          UI.field("日期", date),
          UI.h("div", { class: "row" }, UI.h("div", { class: "grow" }, UI.field("开始时间", start)), UI.h("div", { class: "grow" }, UI.field("结束时间", end))),
          UI.field("关联任务", taskSel, "关联后，完成时间块不会自动完成任务，需在任务列表中确认"),
          UI.h("div", { class: "field" }, UI.h("label", { class: "field-label" }, "已完成"), done)
        );
        box._get = () => ({ title, type, date, start, end, taskSel, done });
      },
      onSubmit: (box, close) => {
        const f = box._get;
        if (!f.title.value.trim()) { UI.toast("标题不能为空"); return false; }
        if (!f.date.value || !f.start.value || !f.end.value) { UI.toast("请填写日期与起止时间"); return false; }
        if (toMin(f.end.value) <= toMin(f.start.value)) { UI.toast("结束时间必须晚于开始时间"); return false; }
        const rec = {
          id: isNew ? uid() : b.id,
          title: f.title.value.trim(),
          type: f.type.value,
          date: f.date.value,
          start: f.start.value,
          end: f.end.value,
          taskId: f.taskSel.value || null,
          done: f.done.checked,
          createdAt: isNew ? Date.now() : b.createdAt,
          updatedAt: Date.now(),
          deleted: false
        };
        // 冲突提醒（允许用户确认后保留）
        const others = Store.blocksOf(rec.date).filter(x => x.id !== rec.id);
        const conflict = others.some(x => toMin(x.start) < toMin(rec.end) && toMin(rec.start) < toMin(x.end));
        const save = () => {
          if (isNew) Store.state.blocks.push(rec);
          else Object.assign(b, rec);
          Store.save();
          this.render();
          if (App.curView === "today") TodayView.render();
          UI.toast(isNew ? "时间块已创建" : "已保存");
        };
        if (conflict) {
          UI.modal({
            title: "时间重叠提醒",
            body: el => el.append(UI.h("p", { class: "modal-text" }, `「${rec.title}」（${rec.start}–${rec.end}）与当天其他时间块重叠。如果是有意安排的（例如边听音频边刷题），可以保留；否则请返回修改。`)),
            submitText: "仍然保存",
            onSubmit: () => save()
          });
          // 关闭当前编辑框，保留冲突确认框
          setTimeout(() => close(), 0);
          return;
        }
        save();
      }
    });
    if (!isNew) {
      // 删除入口
      const dlg = document.querySelector("dialog.modal");
      if (dlg) {
        const del = UI.h("button", { class: "btn danger", type: "button", style: "margin-right:auto" }, "删除时间块");
        del.addEventListener("click", async () => {
          const ok = await UI.confirmDanger("删除时间块", `确定删除「${b.title}」吗？关联的任务不会被删除。`, "删除");
          if (!ok) return;
          b.deleted = true; Store.touch(b); Store.save();
          document.querySelectorAll("dialog.modal").forEach(d => d.remove());
          this.render();
          if (App.curView === "today") TodayView.render();
          UI.toast("已删除");
        });
        dlg.querySelector(".modal-actions").prepend(del);
      }
    }
  }
};

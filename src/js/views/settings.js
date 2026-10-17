/* ================= 视图：设置 ================= */
"use strict";

const SettingsView = {
  render() {
    const el = document.getElementById("view-settings");
    el.innerHTML = "";
    el.append(
      UI.h("div", { class: "row", style: "margin-bottom:14px" },
        UI.h("button", { class: "btn small", type: "button", onclick: () => App.switchView("today") }, "← 返回今日")),
      this.examCard(),
      this.trainingCard(),
      this.goalsCard(),
      this.appearanceCard(),
      this.dataCard()
    );
  },

  examCard() {
    const s = Store.state.settings;
    const name = UI.input({ value: s.examName, maxlength: 30 });
    const date = UI.input({ type: "date", value: s.examDate || "" });
    const save = () => {
      s.examName = name.value.trim() || "考试";
      s.examDate = date.value;
      Store.save();
      if (App.curView === "today") TodayView.render();
      UI.toast("已保存");
    };
    name.addEventListener("change", save);
    date.addEventListener("change", save);
    return UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar" }), "考试倒计时"),
      UI.h("div", { class: "grid2" },
        UI.field("考试名称", name),
        UI.field("考试日期", date)),
      UI.h("div", { class: "field-hint" }, "日期以官方公告为准。首页倒计时和备考进度条由这里的数据计算。")
    );
  },

  trainingCard() {
    const t = Store.state.settings.training;
    const days = UI.h("div", { class: "row" },
      WEEK_SHORT.map((w, i) => {
        const on = t.planDays.includes(i);
        const b = UI.h("button", { class: "chip" + (on ? " active" : ""), type: "button", "aria-pressed": on ? "true" : "false" }, `周${w}`);
        b.addEventListener("click", () => {
          const idx = t.planDays.indexOf(i);
          if (idx >= 0) t.planDays.splice(idx, 1); else t.planDays.push(i);
          t.planDays.sort();
          Store.save();
          b.classList.toggle("active");
          UI.toast("训练日已更新");
        });
        return b;
      }));
    const rest = UI.input({ type: "number", min: 0, max: 600, step: 15, value: t.restSec });
    rest.style.maxWidth = "120px";
    rest.addEventListener("change", () => { t.restSec = parseInt(rest.value || "90", 10) || 90; Store.save(); UI.toast("已保存"); });
    return UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--coral)" }), "训练计划",
        UI.h("span", { class: "extra" }, UI.h("button", { class: "btn small", type: "button", onclick: () => this.editTraining() }, "编辑动作"))),
      UI.h("div", { class: "field" }, UI.h("label", { class: "field-label" }, "每周训练日"), days),
      UI.h("div", { class: "field" }, UI.h("label", { class: "field-label" }, "组间休息（秒）"), rest,
        UI.h("div", { class: "field-hint" }, "训练日用于判断「今天是否训练日」，不影响手动补练"))
    );
  },

  /* 训练动作编辑（可增删改） */
  editTraining() {
    const t = Store.state.settings.training;
    UI.modal({
      title: "编辑训练动作",
      wide: true,
      submitText: "完成",
      cancelText: "关闭",
      body: (box) => {
        const list = UI.h("div", { id: "exEditList" });
        const draw = () => {
          list.innerHTML = "";
          t.exercises.forEach((ex, i) => {
            list.append(UI.h("div", { class: "subject-card", style: "margin-bottom:8px" },
              UI.h("div", { class: "body" },
                UI.h("div", { class: "row" },
                  UI.h("strong", { style: "font-size:13px" }, `${i + 1}.`),
                  UI.input({ value: ex.name, placeholder: "动作名称", "data-f": "name", style: "flex:1;min-width:120px" }),
                  UI.input({ value: ex.part, placeholder: "部位", "data-f": "part", style: "width:90px" })),
                UI.h("div", { class: "row", style: "margin-top:8px" },
                  UI.input({ type: "number", min: 1, max: 20, value: ex.sets, "data-f": "sets", style: "width:70px" }),
                  UI.h("span", { style: "font-size:12px;color:var(--ink-3)" }, "组 ×"),
                  UI.input({ value: ex.reps, placeholder: "次数/时间", "data-f": "reps", style: "flex:1;min-width:100px" })),
                UI.h("input", { value: ex.tip, placeholder: "动作要点（可选）", "data-f": "tip", class: "inp", style: "margin-top:8px" })),
              UI.h("button", { class: "mini-btn danger", type: "button", "aria-label": "删除动作", onclick: () => {
                t.exercises.splice(i, 1);
                Store.save(); draw();
                if (App.curView === "fitness") FitnessView.render();
              } }, UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" })))
            ));
          });
        };
        draw();
        box.append(list);
        box.append(UI.h("button", { class: "btn small", type: "button", style: "margin-top:10px", onclick: () => {
          t.exercises.push({ id: uid(), name: "新动作", sets: 3, reps: "12 次", part: "部位", tip: "" });
          Store.save(); draw();
        } }, "+ 添加动作"));
      },
      onSubmit: (box) => {
        // 收集编辑
        box.querySelectorAll(".subject-card").forEach((card, i) => {
          const ex = t.exercises[i];
          if (!ex) return;
          card.querySelectorAll("[data-f]").forEach(f => {
            const k = f.dataset.f;
            ex[k] = k === "sets" ? (parseInt(f.value || "3", 10) || 3) : f.value;
          });
        });
        Store.save();
        if (App.curView === "fitness") FitnessView.render();
        UI.toast("训练计划已保存");
      }
    });
  },

  goalsCard() {
    const s = Store.state.settings;
    const wg = UI.input({ type: "number", min: 30, max: 200, step: 0.1, value: s.weightGoal === null ? "" : s.weightGoal, placeholder: "例如 72.0" });
    wg.style.maxWidth = "140px";
    const dg = UI.input({ type: "number", min: 0, max: 8000, step: 50, value: s.dietGoalKcal || "", placeholder: "例如 2800" });
    dg.style.maxWidth = "140px";
    wg.addEventListener("change", () => { s.weightGoal = wg.value === "" ? null : parseFloat(wg.value); Store.save(); if (App.curView === "fitness") FitnessView.render(); UI.toast("已保存"); });
    dg.addEventListener("change", () => { s.dietGoalKcal = parseInt(dg.value || "0", 10) || 0; Store.save(); if (App.curView === "fitness") FitnessView.render(); UI.toast("已保存"); });
    return UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--violet)" }), "目标"),
      UI.h("div", { class: "grid2" },
        UI.field("目标体重（kg）", wg, "增重/减重目标，用于对照趋势"),
        UI.field("每日热量目标（kcal）", dg, "0 表示不设置"))
    );
  },

  editWeightGoal() { App.switchView("settings"); setTimeout(() => document.getElementById("view-settings").scrollIntoView({ behavior: "smooth" }), 60); },
  editDietGoal() { App.switchView("settings"); setTimeout(() => document.getElementById("view-settings").scrollIntoView({ behavior: "smooth" }), 60); },

  appearanceCard() {
    const s = Store.state.settings;
    const sel = UI.select([
      { value: "auto", label: "跟随系统" }, { value: "light", label: "浅色" }, { value: "dark", label: "深色" }
    ], s.theme || "auto");
    sel.addEventListener("change", () => { s.theme = sel.value; Store.save(); Theme.apply(); UI.toast("主题已切换"); });
    return UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--amber)" }), "外观"),
      UI.field("主题", sel, "顶栏右侧的月亮/太阳图标可快速切换")
    );
  },

  dataCard() {
    const hasV1 = !!localStorage.getItem(DB_V1_BACKUP_KEY);
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--green)" }), "数据"),
      UI.h("div", { class: "stack" },
        UI.h("div", { class: "row" },
          UI.h("button", { class: "btn", type: "button", onclick: () => App.exportData() }, "导出备份（JSON）"),
          UI.h("button", { class: "btn", type: "button", onclick: () => document.getElementById("fileImport").click() }, "导入备份"),
          hasV1 ? UI.h("button", { class: "btn", type: "button", onclick: () => this.restoreV1() }, "恢复 v1 旧数据") : null),
        UI.h("div", { class: "field-hint" },
          "数据保存在本机浏览器 localStorage。建议定期导出备份；换设备时先导出、再在新设备导入。", UI.h("br"),
          "云同步（多设备实时同步）尚未配置：完成 Supabase 部署后可在此登录，详见仓库 docs/SUPABASE_SETUP.md。"),
        UI.h("button", { class: "btn danger", type: "button", onclick: () => this.clearAll() }, "清空所有数据"))
    );
    return card;
  },

  async restoreV1() {
    const ok = await UI.confirmDanger("恢复 v1 旧数据",
      "将用首次升级时自动备份的 v1 数据覆盖当前全部数据（任务、健身、体重、语录；学习和日程等 v2 功能数据不受影响但会被合并）。确定继续吗？", "确认恢复");
    if (!ok) return;
    try {
      const raw = JSON.parse(localStorage.getItem(DB_V1_BACKUP_KEY) || "null");
      if (!raw) { UI.toast("没有找到 v1 备份"); return; }
      const v1 = migrateV1(raw);
      // 以 v1 数据为主，保留 v2 新增集合中不冲突的记录
      const keepIds = new Set(v1.tasks.map(t => t.id));
      v1.study = Store.state.study.filter(r => !keepIds.has(r.taskId)).concat(v1.study);
      v1.blocks = Store.state.blocks.filter(b => !v1.tasks.some(t => t.id === b.taskId));
      v1.quotes = Store.state.quotes;
      Store.state = v1;
      Store.save();
      App.renderAll();
      UI.toast("v1 数据已恢复");
    } catch (e) {
      UI.toast("恢复失败：" + e.message);
    }
  },

  async clearAll() {
    const ok = await UI.confirmDanger("清空所有数据",
      "将删除全部任务、学习记录、训练记录、体重、饮食、日程和复盘数据，且不可恢复。强烈建议先「导出备份」。确定清空吗？", "全部清空");
    if (!ok) return;
    const ok2 = await UI.confirmDanger("再确认一次", "这是最后一次确认。清空后只能通过之前的备份文件恢复。", "确认清空");
    if (!ok2) return;
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(TIMER_KEY);
    Store.state = defaultState();
    Store.save();
    App.renderAll();
    UI.toast("已清空");
  }
};

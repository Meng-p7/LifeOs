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
      this.cloudCard(),
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

  /* ---- 云同步 ---- */
  cloudCard() {
    const cfg = SupabaseConfig.get();
    const session = SupabaseConfig.getSession();
    const configured = !!(cfg && cfg.url && cfg.key);
    const loggedIn = configured && !!session;

    const card = UI.h("div", { class: "card", id: "cloudCard" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--violet)" }), "云同步",
        UI.h("span", { class: "extra", id: "cloudStatus" }, configured ? (loggedIn ? "已配置 · 已登录" : "已配置 · 未登录") : "未配置"))
    );

    // 配置区
    const urlInp = UI.input({ value: cfg ? cfg.url : "", placeholder: "https://xxxx.supabase.co" });
    const keyInp = UI.input({ type: "password", value: cfg ? cfg.key : "", placeholder: "sb_publishable_..." });
    const showBtn = UI.h("button", { class: "btn small", type: "button", title: "显示/隐藏密钥" }, "显示");
    let shown = false;
    showBtn.addEventListener("click", () => { shown = !shown; keyInp.type = shown ? "text" : "password"; showBtn.textContent = shown ? "隐藏" : "显示"; });
    const saveCfg = async () => {
      const url = urlInp.value.trim().replace(/\/+$/, ""), key = keyInp.value.trim();
      if (!url || !key) { UI.toast("请填写完整的地址和密钥"); return; }
      if (!/^https:\/\/[^\s]+\.supabase\.co$/.test(url) && !/^https:\/\/[^\s]+\.supabase\.in$/.test(url)) {
        UI.toast("地址格式不正确，应为 https://<项目>.supabase.co"); return;
      }
      SupabaseConfig.save({ url, key });
      Sync.adapter = new SupabaseAdapter({ url, key });
      Sync.restoreSession();
      UI.toast("配置已保存，正在恢复会话…");
      setTimeout(() => SettingsView.render(), 1500);
    };
    card.append(
      UI.h("div", { class: "field" }, UI.h("label", { class: "field-label" }, "Supabase 项目地址"), urlInp),
      UI.h("div", { class: "field" }, UI.h("label", { class: "field-label" }, "Publishable Key（前端公开客户端密钥）"),
        UI.h("div", { class: "row" }, UI.h("div", { class: "grow" }, keyInp), showBtn),
        UI.h("div", { class: "field-hint" }, "在 Supabase 控制台 Settings → API 获取。该密钥设计上前端可公开，数据隔离由数据库行级安全（RLS）保证；请勿使用 service_role key。")),
      UI.h("div", { class: "row", style: "margin-bottom:6px" },
        UI.h("button", { class: "btn primary", type: "button", onclick: saveCfg }, "保存并连接"),
        configured ? UI.h("button", { class: "btn danger", type: "button", onclick: async () => {
          const ok = await UI.confirmDanger("清除云同步配置", "将退出登录并清除本机保存的 Supabase 配置。云端数据不会被删除。确定吗？", "清除配置");
          if (!ok) return;
          if (Sync.adapter) await Sync.adapter.signOut().catch(() => {});
          SupabaseConfig.clear();
          SupabaseConfig.saveSession(null);
          Sync.adapter = null;
          Sync.setStatus("local");
          SettingsView.render();
          UI.toast("配置已清除");
        } }, "清除配置") : null)
    );

    if (!configured) {
      card.append(UI.h("div", { class: "field-hint" },
        "配置后可在电脑与手机之间同步任务、学习、训练、体重、日程和复盘。首次登录时，本地已有数据会自动合并上传，不会被空云端覆盖。详细部署步骤见仓库 docs/SUPABASE_SETUP.md。"));
      return card;
    }

    // 账号区
    if (!loggedIn) {
      const email = UI.input({ type: "email", placeholder: "你的邮箱" });
      const pwd = UI.input({ type: "password", placeholder: "密码（至少 6 位）" });
      const doLogin = async () => {
        if (!email.value.trim() || !pwd.value) { UI.toast("填写邮箱和密码"); return; }
        try { await Sync.signIn(email.value.trim(), pwd.value); UI.toast("登录成功，数据已同步"); SettingsView.render(); }
        catch (e) { UI.toast("登录失败：" + Sync.friendlyError(e)); }
      };
      const doSignUp = async () => {
        if (!email.value.trim() || !pwd.value) { UI.toast("填写邮箱和密码"); return; }
        if (pwd.value.length < 6) { UI.toast("密码至少 6 位"); return; }
        try {
          const d = await Sync.signUp(email.value.trim(), pwd.value);
          if (d && d.access_token) { UI.toast("注册成功，数据已同步"); SettingsView.render(); }
          else UI.toast("注册成功：请先到邮箱点确认邮件，再回来登录", 3500);
        } catch (e) { UI.toast("注册失败：" + Sync.friendlyError(e)); }
      };
      card.append(
        UI.h("div", { class: "dlg-sep" }),
        UI.h("div", { class: "field" }, UI.h("label", { class: "field-label" }, "邮箱"), email),
        UI.h("div", { class: "field" }, UI.h("label", { class: "field-label" }, "密码"), pwd),
        UI.h("div", { class: "row" },
          UI.h("button", { class: "btn primary", type: "button", onclick: doLogin }, "登录"),
          UI.h("button", { class: "btn", type: "button", onclick: doSignUp }, "注册新账号")),
        UI.h("div", { class: "field-hint" }, "注册需要邮箱确认（Supabase 默认开启）；确认后返回本页登录。账号数据仅保存在你自己的 Supabase 项目中。")
      );
    } else {
      const emailTxt = (session.email || SupabaseConfig.getSession() && SupabaseConfig.getSession().email || "已登录");
      card.append(
        UI.h("div", { class: "dlg-sep" }),
        UI.h("div", { class: "row", style: "margin-bottom:10px" },
          UI.h("span", { style: "font-size:13.5px;font-weight:700" }, `账号：${emailTxt}`)),
        UI.h("div", { class: "row" },
          UI.h("button", { class: "btn primary", type: "button", onclick: async () => {
            try {
              const remote = await Sync.adapter.pull();
              Store.state = mergeStates(Store.state, remote);
              Store.save();
              await Sync.adapter.push(Store.state);
              Sync.setStatus("synced");
              App.renderAll();
              UI.toast("已同步");
            } catch (e) { Sync.setStatus("error", e.message); UI.toast("同步失败：" + Sync.friendlyError(e)); }
          } }, "立即同步"),
          UI.h("button", { class: "btn", type: "button", onclick: async () => {
            await Sync.signOut(); SettingsView.render(); UI.toast("已退出登录");
          } }, "退出登录")),
        UI.h("div", { class: "field-hint" }, "本地改动会在停止操作约 1 秒后自动上传；顶栏芯片显示实时同步状态。")
      );
    }
    return card;
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

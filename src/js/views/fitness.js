/* ================= 视图：健身与增重 ================= */
"use strict";

const FitnessView = {
  render() {
    const el = document.getElementById("view-fitness");
    el.innerHTML = "";
    el.append(
      this.banner(),
      this.statsRow(),
      this.todayCard(),
      this.weightCard(),
      this.dietCard(),
      this.historyCard()
    );
    // 卡片已挂载到文档，再渲染依赖 DOM 的图表与列表
    this.renderWeightChart();
    this.renderWeightList();
  },

  banner() {
    const dow = today().getDay();
    const isPlan = Store.state.settings.training.planDays.includes(dow);
    return UI.h("div", { class: "card fit-banner " + (isPlan ? "on" : "off") },
      UI.h("div", { class: "icon" },
        UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("path", { d: "M6.5 6.5h11v11h-11z" }), UI.h("path", { d: "M2 9v6M22 9v6M6.5 2v4M17.5 2v4M6.5 18v4M17.5 18v4" }))),
      UI.h("div", {},
        UI.h("h3", {}, isPlan ? "今天是训练日" : "今天不是计划训练日"),
        UI.h("p", {}, isPlan ? `${WEEK_CN[dow]} · 按计划完成今日动作` : "休息日，好好恢复；也可以主动补练")),
      UI.h("div", { class: "rule", style: "margin-left:auto;text-align:right;font-size:12.5px;color:var(--ink-2);font-weight:600" },
        `每周 ${Store.state.settings.training.planDays.map(d => WEEK_CN[d]).join(" / ")}`, UI.h("br"),
        `${Store.state.settings.training.exercises.length} 个动作`)
    );
  },

  statsRow() {
    const [w0, w1] = weekRange();
    const monthPrefix = todayStr().slice(0, 7);
    const monthFit = Object.keys(Store.state.fitness).filter(d => d.startsWith(monthPrefix)).length;
    const weekFit = Object.keys(Store.state.fitness).filter(d => d >= w0 && d <= w1).length;
    const dates = Object.keys(Store.state.fitness).sort();
    let best = 0, cur = 0;
    dates.forEach((d, i) => {
      if (i === 0) cur = 1;
      else {
        const p = new Date(d); p.setDate(p.getDate() - 1);
        cur = Store.state.fitness[dstr(p)] ? cur + 1 : 1;
      }
      best = Math.max(best, cur);
    });
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = today(); d.setDate(d.getDate() - i);
      if (Store.state.fitness[dstr(d)]) streak++;
      else { if (i === 0) continue; break; }
    }
    return UI.h("div", { class: "stat-row", style: "margin-bottom:16px" },
      UI.stat({ value: monthFit, label: "本月训练", color: "blue", sub: "天" }),
      UI.stat({ value: weekFit, label: "本周训练", color: "coral", sub: `计划 ${Store.state.settings.training.planDays.length} 次` }),
      UI.stat({ value: `${streak} 天`, label: "当前连续", color: streak ? "green" : "" }),
      UI.stat({ value: `${best} 天`, label: "最长连续", color: "violet" })
    );
  },

  /* ---- 今日训练打卡 ---- */
  todayCard() {
    const ts = todayStr();
    const plan = Store.state.settings.training;
    const rec = Store.state.fitness[ts] || { checks: {} };
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--coral)" }), "今日训练",
        UI.h("span", { class: "extra" },
          UI.h("button", { class: "btn small", type: "button", onclick: () => SettingsView.editTraining() }, "编辑训练计划")))
    );
    const grid = UI.h("div", { class: "ex-grid" });
    const totalSets = plan.exercises.reduce((a, e) => a + e.sets, 0);
    let doneSets = 0;
    plan.exercises.forEach((ex, i) => {
      const checks = rec.checks && rec.checks[ex.id] || [];
      const n = checks.filter(Boolean).length;
      doneSets += n;
      const allDone = n === ex.sets;
      grid.append(UI.h("div", { class: "ex" + (allDone ? " all-done" : "") },
        UI.h("div", { class: "ex-head" },
          UI.h("span", { class: "ex-num" }, String(i + 1)),
          UI.h("span", { class: "ex-name" }, ex.name),
          UI.h("span", { class: "ex-part" }, ex.part)),
        UI.h("div", { class: "ex-target" }, `${ex.sets} 组 × ${ex.reps}`),
        ex.tip ? UI.h("div", { class: "ex-tip" }, ex.tip) : null,
        UI.h("div", { class: "sets" },
          Array.from({ length: ex.sets }, (_, s) => UI.h("button", {
            class: "set-btn" + (checks[s] ? " on" : ""), type: "button",
            "aria-label": `${ex.name} 第 ${s + 1} 组`, "aria-pressed": checks[s] ? "true" : "false",
            onclick: () => this.toggleSet(ex.id, s, ex.sets)
          }, String(s + 1))),
          UI.h("span", { class: "lbl" }, "组"))
      ));
    });
    card.append(grid);

    // RPE + 备注
    const rpe = UI.select(Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}${i === 0 ? "（很轻松）" : i === 8 ? "（很吃力）" : i === 9 ? "（极限）" : ""}` })), String(rec.rpe || ""), { allLabel: "主观难度（可选）" });
    rpe.style.maxWidth = "180px";
    const note = UI.h("textarea", { class: "inp", placeholder: "训练备注：重量、状态、感受……", id: "fitNote" });
    note.value = rec.note || "";
    rpe.addEventListener("change", () => { this.saveToday({ rpe: rpe.value }); });
    note.addEventListener("input", () => {
      clearTimeout(note._tm);
      note._tm = setTimeout(() => this.saveToday({ note: note.value }), 500);
    });
    card.append(
      UI.h("div", { class: "row", style: "margin-top:14px" }, rpe),
      note,
      UI.h("div", { class: "rest-tip" },
        UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round" }, UI.h("circle", { cx: "12", cy: "12", r: "10" }), UI.h("polyline", { points: "12 6 12 12 16 14" })),
        `每组之间休息 ${plan.restSec} 秒；单臂动作左右交替，左右各一次合计为一次`),
      UI.h("div", { style: "font-size:12.5px;color:var(--ink-3);margin-top:10px" }, `今日进度：${doneSets} / ${totalSets} 组`)
    );
    return card;
  },

  toggleSet(exId, idx, sets) {
    const ts = todayStr();
    if (!Store.state.fitness[ts]) Store.state.fitness[ts] = { checks: {}, note: "", rpe: "" };
    const rec = Store.state.fitness[ts];
    if (!rec.checks[exId]) rec.checks[exId] = Array(sets).fill(false);
    rec.checks[exId][idx] = !rec.checks[exId][idx];
    rec.updatedAt = Date.now();
    Store.save();
    this.render();
    const plan = Store.state.settings.training;
    const total = plan.exercises.reduce((a, e) => a + e.sets, 0);
    const done = plan.exercises.reduce((a, e) => a + ((rec.checks[e.id] || []).filter(Boolean).length), 0);
    if (done === total) UI.toast("今日训练全部完成 💪");
  },

  saveToday(patch) {
    const ts = todayStr();
    if (!Store.state.fitness[ts]) Store.state.fitness[ts] = { checks: {}, note: "", rpe: "" };
    Object.assign(Store.state.fitness[ts], patch, { updatedAt: Date.now() });
    Store.save();
  },

  /* ---- 体重 ---- */
  weightCard() {
    const ts = todayStr();
    const cur = Store.weightOf(ts);
    const goal = Store.state.settings.weightGoal;
    const avg7 = Store.weight7Avg(ts);
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--violet)" }), "每日体重",
        UI.h("span", { class: "extra" }, goal ? `目标 ${goal} kg` : "未设目标"),
        UI.h("span", {},
          UI.h("button", { class: "btn small", type: "button", onclick: () => SettingsView.editWeightGoal() }, goal ? "修改目标" : "设目标")))
    );
    const inp = UI.input({ type: "number", step: "0.1", min: "30", max: "200", placeholder: "0.0", value: cur === null ? "" : cur, id: "wInp" });
    inp.style.maxWidth = "130px";
    const add = () => {
      const v = parseFloat(inp.value);
      if (isNaN(v) || v < 30 || v > 200) { UI.toast("请输入 30–200 之间的体重（kg）"); return; }
      Store.state.weight[ts] = +v.toFixed(1);
      Store.save(); this.render();
      UI.toast("体重已记录");
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") add(); });
    const y = new Date(today()); y.setDate(y.getDate() - 1);
    const prev = Store.weightOf(dstr(y));
    let deltaTxt = "", deltaCls = "flat";
    if (cur !== null && prev !== null && cur !== prev) {
      const d = +(cur - prev).toFixed(1);
      deltaTxt = `较昨日 ${d > 0 ? "+" : ""}${d} kg`;
      deltaCls = d > 0 ? "up" : d < 0 ? "down" : "flat";
    } else if (cur !== null) deltaTxt = "今日已记录";
    card.append(
      UI.h("div", { class: "row" }, inp, UI.h("span", { style: "font-weight:700;color:var(--ink-2)" }, "kg"),
        UI.h("button", { class: "btn primary", type: "button", onclick: add }, "记录"),
        UI.h("span", { class: `delta ${deltaCls}`, style: "margin-left:auto;font-weight:700;font-size:13px" }, deltaTxt)),
      UI.h("div", { class: "chart-box", style: "margin-top:12px", id: "wChartBox" }),
      UI.h("div", { id: "wList" })
    );
    return card;
  },

  renderWeightChart() {
    const box = document.getElementById("wChartBox");
    if (!box) return;
    box.innerHTML = "";
    const series = [];
    for (let i = 29; i >= 0; i--) {
      const d = today(); d.setDate(d.getDate() - i);
      const ds = dstr(d);
      const v = Store.weightOf(ds);
      if (v !== null) series.push({ label: ds.slice(5).replace("-", "/"), value: v, date: ds });
    }
    const avg7 = Store.weight7Avg(todayStr());
    const points = series.map(p => ({ label: p.label, value: p.value }));
    const chart = Charts.line({ points, unit: " kg", label: "最近 30 天体重趋势" });
    if (!chart) {
      box.append(UI.empty(series.length ? "只有一个记录" : "暂无体重记录", series.length ? "再记一天就能看到趋势曲线" : "每天花三秒记一下，30 天出趋势"));
      return;
    }
    box.append(UI.h("div", { style: "font-size:13px;font-weight:700;margin-bottom:8px" }, "最近 30 天体重趋势（kg）"), chart);
    const notes = [];
    if (avg7 !== null) notes.push(`7 日平均 ${avg7} kg（平滑日常波动）`);
    if (series.length >= 2) {
      const d = +(series[series.length - 1].value - series[0].value).toFixed(1);
      notes.push(`区间变化 ${d > 0 ? "+" : ""}${d} kg`);
    }
    if (notes.length) box.append(UI.h("div", { class: "chart-note" }, notes.join(" · ") + "。单次体重受水分和饮食影响，以 7 日均值判断趋势。"));
  },

  renderWeightList() {
    const box = document.getElementById("wList");
    if (!box) return;
    box.innerHTML = "";
    const entries = Object.keys(Store.state.weight).sort().reverse();
    if (!entries.length) { box.append(UI.empty("还没有记录", "输入体重后点「记录」")); return; }
    const list = UI.h("div", {});
    entries.slice(0, 10).forEach((d, i) => {
      const prevD = entries[i + 1];
      const diff = prevD !== undefined ? +(Store.state.weight[d] - Store.state.weight[prevD]).toFixed(1) : null;
      const txt = diff === null ? "—" : (diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "±0");
      const cls = diff === null ? "flat" : diff > 0 ? "up" : diff < 0 ? "down" : "flat";
      list.append(UI.h("div", { class: "w-item" },
        UI.h("span", { class: "d" }, d.slice(5).replace("-", "/")),
        UI.h("span", { class: "v" }, `${Store.state.weight[d]} kg`),
        UI.h("span", { class: `delta ${cls}` }, diff === null ? "" : `${txt} kg`),
        UI.h("button", { class: "del", type: "button", "aria-label": "删除该记录", onclick: async () => {
          const ok = await UI.confirmDanger("删除体重记录", `确定删除 ${d} 的记录吗？`, "删除");
          if (!ok) return;
          delete Store.state.weight[d]; Store.save(); this.renderWeightChart(); this.renderWeightList(); UI.toast("已删除");
        } }, UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.4", "stroke-linecap": "round" }, UI.h("path", { d: "M18 6L6 18M6 6l12 12" }))))
      );
    });
    box.append(UI.h("div", { class: "sec-title", style: "margin-top:16px" }, UI.h("h2", {}, "体重历史"), UI.h("span", { class: "extra" }, "最近 10 条")), list);
  },

  /* ---- 饮食 ---- */
  dietCard() {
    const ts = todayStr();
    const goal = Store.state.settings.dietGoalKcal;
    const kcal = Store.dietKcal(ts);
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" },
        UI.h("span", { class: "bar", style: "background:var(--amber)" }), "饮食记录",
        UI.h("span", { class: "extra" }, goal ? `目标 ${goal} kcal/天` : "未设目标"),
        UI.h("span", {},
          UI.h("button", { class: "btn small", type: "button", onclick: () => SettingsView.editDietGoal() }, goal ? "修改目标" : "设目标")))
    );
    const rows = UI.h("div", { id: "dietRows" });
    const items = Store.dietOf(ts);
    if (items.length) {
      items.forEach(it => {
        rows.append(UI.h("div", { class: "diet-row" },
          UI.h("span", { class: "meal" }, it.meal),
          UI.h("span", { class: "food" }, it.food),
          UI.h("span", { class: "kcal" }, `${it.kcal} kcal`),
          UI.h("button", { class: "del", type: "button", "aria-label": "删除饮食记录", onclick: () => {
            it.deleted = true; Store.touch(it); Store.save(); this.render(); UI.toast("已删除");
          } }, UI.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.4", "stroke-linecap": "round" }, UI.h("path", { d: "M18 6L6 18M6 6l12 12" })))
        ));
      });
    } else {
      rows.append(UI.empty("今天还没有饮食记录", "热量为手动估算值，仅供趋势参考"));
    }
    card.append(rows);
    const total = UI.h("div", { class: "diet-total" },
      UI.h("span", {}, `今日摄入 ${kcal} kcal`),
      UI.h("span", {}, goal ? (kcal > goal ? `超出 ${kcal - goal}` : `还可 ${goal - kcal}`) : "未设目标"));
    card.append(total);
    const meal = UI.select(MEALS.map(m => ({ value: m, label: m })), "早餐");
    meal.style.maxWidth = "110px";
    const food = UI.input({ placeholder: "食物名称" });
    const kc = UI.input({ type: "number", min: 0, max: 5000, step: 10, placeholder: "kcal" });
    kc.style.maxWidth = "100px";
    const add = () => {
      if (!food.value.trim()) { UI.toast("填写食物名称"); return; }
      const v = parseInt(kc.value || "0", 10);
      if (isNaN(v) || v < 0) { UI.toast("填写正确的热量数值"); return; }
      if (!Store.state.diet[ts]) Store.state.diet[ts] = [];
      Store.state.diet[ts].push({ id: uid(), meal: meal.value, food: food.value.trim(), kcal: v, note: "", createdAt: Date.now(), updatedAt: Date.now(), deleted: false });
      Store.save(); this.render();
      food.value = ""; kc.value = "";
      UI.toast("已记录");
    };
    card.append(UI.h("div", { class: "add-row", style: "margin-top:12px" }, meal, food, kc, UI.h("button", { class: "btn primary", type: "button", onclick: add }, "添加")),
      UI.h("div", { class: "chart-note" }, "热量来自你的手动输入或估算，不是精确测量；建议固定称重或按包装标签填写，保持口径一致。"));
    return card;
  },

  /* ---- 训练历史 ---- */
  historyCard() {
    const card = UI.h("div", { class: "card" },
      UI.h("div", { class: "card-title" }, UI.h("span", { class: "bar", style: "background:var(--green)" }), "训练历史", UI.h("span", { class: "extra" }, "最近 14 次"))
    );
    const dates = Object.keys(Store.state.fitness).sort().reverse();
    const list = UI.h("div", { class: "hist" });
    if (!dates.length) {
      list.append(UI.empty("还没有训练记录", "完成今日打卡后这里会出现历史"));
    } else {
      const plan = Store.state.settings.training;
      const total = plan.exercises.reduce((a, e) => a + e.sets, 0);
      dates.slice(0, 14).forEach(d => {
        const rec = Store.state.fitness[d];
        const done = plan.exercises.reduce((a, e) => a + ((rec.checks && rec.checks[e.id] || []).filter(Boolean).length), 0);
        const pct = Math.round(done / total * 100);
        list.append(UI.h("div", { class: "hist-item" },
          UI.h("span", { class: "hist-date" }, `${d.slice(5).replace("-", "/")} ${WEEK_CN[parseDate(d).getDay()]}`),
          UI.h("span", { class: "hist-bar" }, UI.h("i", { style: `width:${pct}%` })),
          UI.h("span", { class: "hist-n" }, `${done}/${total}`),
          rec.rpe ? UI.h("span", { class: "rpe-badge" }, `RPE ${rec.rpe}`) : null,
          rec.note ? UI.h("span", { class: "hist-note" }, rec.note) : null
        ));
      });
    }
    card.append(list);
    return card;
  }
};

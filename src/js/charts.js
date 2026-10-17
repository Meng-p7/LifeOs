/* ================= SVG 图表库（零依赖） ================= */
"use strict";

const Charts = {
  svg(w, h, content, label) {
    const ns = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", `0 0 ${w} ${h}`);
    s.setAttribute("role", "img");
    if (label) s.setAttribute("aria-label", label);
    s.style.width = "100%";
    s.style.height = "auto";
    s.style.display = "block";
    s.innerHTML = content;
    return s;
  },

  /* ---------- 折线图（体重/学习趋势） ---------- */
  line({ points, w = 620, h = 180, unit = "", color = "var(--blue)", label }) {
    // points: [{label, value}]
    if (!points || points.length < 2) return null;
    const PL = 40, PR = 14, PT = 16, PB = 26;
    const vals = points.map(p => p.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (max - min < 0.001) { max = min + 0.5; min -= 0.5; }
    else { const pad = (max - min) * 0.14; max += pad; min -= pad; }
    const x = i => PL + (w - PL - PR) * (i / (points.length - 1));
    const y = v => PT + (h - PT - PB) * (1 - (v - min) / (max - min));
    const pts = points.map((p, i) => [x(i), y(p.value)]);
    const path = "M" + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L");
    const area = path + ` L${x(points.length - 1).toFixed(1)},${h - PB} L${x(0).toFixed(1)},${h - PB} Z`;
    const gid = "lg-" + Math.random().toString(36).slice(2, 8);
    const dots = pts.map((p, i) =>
      `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="${i === pts.length - 1 ? color : "var(--surface)"}" stroke="${color}" stroke-width="2.5"><title>${esc(points[i].label)}：${points[i].value}${unit}</title></circle>`).join("");
    const content = `
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity=".22"/>
          <stop offset="1" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="${PL}" y1="${h - PB}" x2="${w - PR}" y2="${h - PB}" stroke="var(--line)" stroke-width="1.5"/>
      <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${h - PB}" stroke="var(--line)" stroke-width="1.5"/>
      <text class="chart-axis" x="${PL - 6}" y="${PT + 9}" text-anchor="end">${max.toFixed(1)}</text>
      <text class="chart-axis" x="${PL - 6}" y="${h - PB + 4}" text-anchor="end">${min.toFixed(1)}</text>
      <path d="${area}" fill="url(#${gid})" class="chart-area"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chart-line"/>
      ${dots}
      <text class="chart-axis" x="${PL}" y="${h - 6}">${esc(points[0].label)}</text>
      <text class="chart-axis" x="${w - PR}" y="${h - 6}" text-anchor="end">${esc(points[points.length - 1].label)}</text>`;
    return this.svg(w, h, content, label);
  },

  /* ---------- 柱状图（每日学习时长/任务完成） ---------- */
  bars({ items, w = 620, h = 190, unit = "", label, highlightLast = true }) {
    // items: [{label, value, tip}]
    if (!items || !items.length) return null;
    const PL = 8, PR = 8, PT = 18, PB = 28;
    const max = Math.max(1, ...items.map(i => i.value));
    const bw = (w - PL - PR) / items.length;
    const bars = items.map((it, i) => {
      const bh = Math.max(3, (h - PT - PB) * (it.value / max));
      const x = PL + i * bw + bw * 0.18;
      const y = h - PB - bh;
      const isToday = highlightLast && i === items.length - 1;
      return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="6" fill="${isToday ? "var(--blue)" : "var(--blue-soft-2)"}" stroke="${isToday ? "var(--blue)" : "var(--blue-2)"}" stroke-width="1.5"><title>${esc(it.tip || it.label)}：${it.value}${unit}</title></rect>
      <text class="chart-axis" x="${(x + bw * 0.32).toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(it.label)}</text></g>`;
    }).join("");
    return this.svg(w, h, bars, label);
  },

  /* ---------- 横向条形（科目分布） ---------- */
  hbars({ items, label }) {
    // items: [{name, done, total, onClick}]
    if (!items || !items.length) return null;
    const rows = items.map(it => {
      const pct = it.total ? Math.round(it.done / it.total * 100) : 0;
      return `<div class="hbar-row" ${it.onClick ? 'data-click="1"' : ""}>
        <span class="hbar-name">${esc(it.name)}</span>
        <span class="hbar-track"><span class="hbar-fill" style="width:${pct}%"></span></span>
        <span class="hbar-n">${it.done}/${it.total}</span>
      </div>`;
    }).join("");
    const div = UI.h("div", { class: "hbars", role: "img", "aria-label": label || "科目分布" });
    div.innerHTML = rows;
    if (items.some(i => i.onClick)) {
      div.querySelectorAll(".hbar-row").forEach((row, i) => {
        if (items[i].onClick) row.addEventListener("click", items[i].onClick);
      });
    }
    return div;
  },

  /* ---------- 进度环 ---------- */
  ring(pct, { size = 120, stroke = 11, color = "var(--blue)", label }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
    const content = `
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" class="chart-ring">
        <animate attributeName="stroke-dashoffset" from="${c.toFixed(1)}" to="${off.toFixed(1)}" dur="0.9s" fill="freeze"/>
      </circle>
      <text x="50%" y="47%" text-anchor="middle" dominant-baseline="middle" class="chart-ring-text">${pct}%</text>
      ${label ? `<text x="50%" y="63%" text-anchor="middle" dominant-baseline="middle" class="chart-ring-sub">${esc(label)}</text>` : ""}`;
    const el = this.svg(size, size, content, `完成率 ${pct}%`);
    el.style.width = size + "px";
    return el;
  },

  /* ---------- 热力图 ---------- */
  heatmap({ weeks = 8, getState, getTitle, label }) {
    // getState(dateStr) => "" | "part" | "full" | "plan"
    const t = today(), dow = (t.getDay() + 6) % 7;
    const mon = new Date(t); mon.setDate(t.getDate() - dow - 7 * (weeks - 1));
    const cells = [];
    for (let wk = 0; wk < weeks; wk++) for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(d.getDate() + wk * 7 + i);
      const ds = dstr(d);
      const st = getState(ds);
      const cls = ["heat-cell"];
      if (st === "full") cls.push("full");
      else if (st === "part") cls.push("part");
      else if (st === "plan") cls.push("plan");
      if (ds === todayStr()) cls.push("now");
      cells.push(UI.h("div", { class: cls.join(" "), title: getTitle(ds), role: "img", "aria-label": getTitle(ds) }));
    }
    return UI.h("div", { class: "heat" }, cells);
  }
};

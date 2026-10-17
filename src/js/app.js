/* ================= 应用入口 ================= */
"use strict";

const App = {
  curView: "today",

  init() {
    Store.load();
    Theme.init();
    Sync.init();
    Timer.restore();
    this.initLiquidGlass();
    this.bindNav();
    this.bindTopbar();
    this.initBg();
    this.initScrollFx();
    this.renderAll();
    // 窗口尺寸变化时重定位 pill
    window.addEventListener("resize", () => this.moveNavPill());
  },

  bindNav() {
    document.getElementById("nav").addEventListener("click", e => {
      const btn = e.target.closest(".nav-item");
      if (!btn) return;
      this.switchView(btn.dataset.view);
    });
  },

  bindTopbar() {
    document.getElementById("btnTheme").addEventListener("click", () => { Theme.toggle(); this.syncThemeIcon(); });
    document.getElementById("btnExport").addEventListener("click", () => this.exportData());
    document.getElementById("btnSettings").addEventListener("click", () => this.switchView("settings"));
    document.getElementById("syncChip").addEventListener("click", () => {
      if (!Sync.adapter) { App.switchView("settings"); setTimeout(() => document.getElementById("cloudCard").scrollIntoView({ behavior: "smooth" }), 80); return; }
      if (Sync.status === "loggedout") { App.switchView("settings"); setTimeout(() => document.getElementById("cloudCard").scrollIntoView({ behavior: "smooth" }), 80); return; }
      Sync.retry();
    });
    this.syncThemeIcon();
  },

  syncThemeIcon() {
    const btn = document.getElementById("btnTheme");
    const dark = Theme.current() === "dark";
    btn.innerHTML = dark
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
    btn.title = dark ? "切换到浅色" : "切换到深色";
  },

  switchView(v) {
    this.curView = v;
    ["today", "tasks", "study", "fitness", "review", "settings"].forEach(x => {
      const el = document.getElementById("view-" + x);
      if (!el) return;
      el.classList.toggle("show", x === v);
      el.hidden = x !== v;
    });
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    this.moveNavPill();
    window.scrollTo({ top: 0, behavior: "instant" });
    if (v === "today") TodayView.render();
    if (v === "tasks") { TasksView.render(); }
    if (v === "study") StudyView.render();
    if (v === "fitness") FitnessView.render();
    if (v === "review") ReviewView.render();
    if (v === "settings") SettingsView.render();
  },

  /* Liquid Glass 导航：滑动 pill 跟随激活项 */
  moveNavPill() {
    const pill = document.getElementById("navPill");
    const active = document.querySelector(".nav-item.active");
    if (!pill || !active) return;
    const r = active.getBoundingClientRect();
    const nr = active.parentElement.getBoundingClientRect();
    pill.style.width = r.width + "px";
    pill.style.opacity = "1";
    pill.style.transform = `translateX(${r.left - nr.left}px)`;
  },

  /* 生成 SVG 折射滤镜（feImage 位移贴图 + feDisplacementMap），参考 archisvaze/liquid-glass
   * 仅 Chrome 生效（@supports 检测），Firefox/Safari 自动降级为 CSS blur */
  initLiquidGlass() {
    const defs = document.getElementById("lg-defs");
    if (!defs) return;
    try {
      const W = 440, H = 84, R = 26;
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          // 越靠近左右边缘与圆角，位移越大（模拟玻璃边缘厚度折射）
          const dx = Math.min(x + 1, W - x);
          const dy = Math.min(y + 1, H - y);
          const edgeX = Math.min(1, dx / (R * 1.7));
          const edgeY = Math.min(1, dy / (R * 1.0));
          const edge = Math.min(edgeX, edgeY);
          const s = Math.pow(1 - edge, 1.6);
          const i = (y * W + x) * 4;
          img.data[i] = 128 + s * 100;      // R 通道 → 水平位移
          img.data[i + 1] = 128 + s * 26;   // G 通道 → 垂直微位移
          img.data[i + 2] = 128;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const url = c.toDataURL();
      defs.innerHTML = `<filter id="lg-glass" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>
        <feImage href="${url}" x="0" y="0" width="100%" height="100%" result="dm" preserveAspectRatio="none"/>
        <feDisplacementMap in="b" in2="dm" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feColorMatrix in="d" type="saturate" values="1.55"/>
      </filter>`;
    } catch (e) { /* 降级：无滤镜时 CSS blur 仍生效 */ }
  },

  renderAll() {
    const line = document.getElementById("dateLine");
    if (line) line.textContent = `${today().getFullYear()} 年 ${today().getMonth() + 1} 月 ${today().getDate()} 日 · ${WEEK_CN[today().getDay()]}`;
    this.switchView(this.curView);
    Sync.renderChip();
  },

  /* ---- 导入 / 导出 ---- */
  exportData() {
    const blob = new Blob([JSON.stringify({ ...Store.state, exportAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `LifeOS备份_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast("备份文件已下载");
  },

  bindImport() {
    document.getElementById("fileImport").addEventListener("change", async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== "object" || !Array.isArray(data.tasks)) throw new Error("缺少 tasks 字段");
        const ok = await UI.confirmDanger("导入备份", "导入将合并/覆盖当前数据（同 ID 记录以较新者为准）。建议先导出当前数据作为备份。继续吗？", "确认导入");
        if (!ok) { e.target.value = ""; return; }
        const merged = mergeStates(Store.state, data);
        Store.state = merged;
        Store.save();
        this.renderAll();
        UI.toast("导入成功");
      } catch (err) {
        UI.toast("导入失败：文件格式不正确（" + err.message + "）");
      }
      e.target.value = "";
    });
  },

  /* ---- 动态背景（低强度，不干扰操作） ---- */
  initBg() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = document.getElementById("bgCanvas");
    const ctx = cv.getContext("2d");
    let W, H, DPR;
    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const blobs = [
      { x: .15, y: .18, r: .42, vx: .00022, vy: .00016, c: [59, 110, 245], a: .10 },
      { x: .85, y: .25, r: .36, vx: -.00018, vy: .00021, c: [123, 92, 240], a: .09 },
      { x: .55, y: .85, r: .44, vx: .00015, vy: -.00019, c: [255, 90, 122], a: .07 },
      { x: .25, y: .7, r: .3, vx: .0002, vy: .00014, c: [23, 178, 106], a: .06 }
    ].map(b => ({ ...b, x: b.x * W, y: b.y * H, r: b.r * Math.max(W, H) }));
    let t = 0;
    (function draw() {
      t++;
      ctx.clearRect(0, 0, W, H);
      blobs.forEach(b => {
        b.x += b.vx * W * .05; b.y += b.vy * H * .05;
        if (b.x < -b.r * .6) b.x = W + b.r * .6; if (b.x > W + b.r * .6) b.x = -b.r * .6;
        if (b.y < -b.r * .6) b.y = H + b.r * .6; if (b.y > H + b.r * .6) b.y = -b.r * .6;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${b.a})`);
        g.addColorStop(1, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(draw);
    })();
  },

  initScrollFx() {
    const bar = document.getElementById("scrollProgress");
    const tb = document.getElementById("topbar");
    window.addEventListener("scroll", () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? window.scrollY / h * 100 : 0) + "%";
      tb.classList.toggle("stuck", window.scrollY > 8);
    }, { passive: true });
  }
};

/* 设置视图容器（动态加入，避免模板过长） */
(function ensureSettingsView() {
  const sec = document.createElement("section");
  sec.className = "view";
  sec.id = "view-settings";
  sec.setAttribute("role", "tabpanel");
  sec.setAttribute("aria-label", "设置");
  sec.hidden = true;
  document.getElementById("main").append(sec);
})();

document.addEventListener("DOMContentLoaded", () => {
  App.bindImport();
  App.init();
});

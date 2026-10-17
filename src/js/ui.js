/* ================= UI 工具层 ================= */
"use strict";

const UI = {
  $: s => document.querySelector(s),
  $$: s => Array.from(document.querySelectorAll(s)),

  /* 创建元素快捷方式（自动处理 SVG 命名空间） */
  SVG_TAGS: new Set(["svg", "path", "circle", "line", "polyline", "polygon", "rect", "text", "g", "stop", "defs", "linearGradient", "radialGradient", "animate", "title", "tspan", "ellipse"]),
  h(tag, attrs = {}, ...children) {
    const el = this.SVG_TAGS.has(tag)
      ? document.createElementNS("http://www.w3.org/2000/svg", tag)
      : document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    children.flat().forEach(c => {
      if (c == null) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  },

  toast(msg, ms = 2200) {
    const t = UI.$("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove("show"), ms);
  },

  /* ---------- 模态框系统 ---------- */
  modal({ title, body, submitText = "确定", cancelText = "取消", danger = false, wide = false, onSubmit }) {
    const dlg = UI.h("dialog", { class: "modal" + (wide ? " wide" : "") + (danger ? " danger" : "") });
    const form = UI.h("form", { method: "dialog", class: "modal-form", novalidate: true });
    const close = () => { dlg.close(); dlg.remove(); };

    dlg.append(
      UI.h("div", { class: "modal-head" },
        UI.h("h2", {}, title),
        UI.h("button", { class: "icon-btn", type: "button", "aria-label": "关闭", onclick: close },
          UI.h("span", { "aria-hidden": true, style: "font-size:18px;line-height:1" }, "×")))
    );
    const bodyEl = UI.h("div", { class: "modal-body" });
    if (typeof body === "function") body(bodyEl, close);
    else if (body) bodyEl.append(body);
    const actions = UI.h("div", { class: "modal-actions" },
      UI.h("button", { class: "btn", type: "button", onclick: close }, cancelText),
      UI.h("button", { class: "btn " + (danger ? "danger" : "primary"), type: "submit" }, submitText)
    );
    form.append(bodyEl, actions);
    form.addEventListener("submit", e => {
      e.preventDefault();
      if (onSubmit) {
        const r = onSubmit(bodyEl, close);
        if (r === false) return;
      }
      close();
    });
    dlg.append(form);
    document.body.append(dlg);
    dlg.showModal();
    // 自动聚焦第一个输入
    setTimeout(() => { const f = dlg.querySelector("input,select,textarea,button.primary"); if (f) f.focus(); }, 30);
    return { dlg, close };
  },

  /* 危险操作二次确认 */
  confirmDanger(title, message, confirmText = "确认删除") {
    return new Promise(resolve => {
      let resolved = false;
      const m = UI.modal({
        title, danger: true, submitText: confirmText,
        body: el => el.append(UI.h("p", { class: "modal-text" }, message)),
        onSubmit: () => { resolved = true; resolve(true); }
      });
      m.dlg.addEventListener("close", () => { if (!resolved) resolve(false); });
    });
  },

  /* ---------- 表单字段 ---------- */
  field(labelText, input, hint) {
    const lab = UI.h("label", { class: "field-label" }, labelText);
    const wrap = UI.h("div", { class: "field" }, lab, input);
    if (hint) wrap.append(UI.h("div", { class: "field-hint" }, hint));
    return wrap;
  },

  input({ type = "text", value = "", placeholder = "", min, max, step, required = false, id }) {
    const el = UI.h("input", { type, value: value == null ? "" : String(value), placeholder, class: "inp" });
    if (min != null) el.min = min;
    if (max != null) el.max = max;
    if (step != null) el.step = step;
    if (required) el.required = true;
    if (id) el.id = id;
    return el;
  },

  select(options, value, { allLabel } = {}) {
    const sel = UI.h("select", { class: "inp" });
    if (allLabel) sel.append(UI.h("option", { value: "" }, allLabel));
    options.forEach(o => {
      const opt = UI.h("option", { value: o.value }, o.label);
      if (String(o.value) === String(value)) opt.selected = true;
      sel.append(opt);
    });
    return sel;
  },

  /* ---------- 空状态 / 加载 ---------- */
  empty(title, sub, actionBtn) {
    return UI.h("div", { class: "empty" },
      UI.h("div", { class: "empty-icon", "aria-hidden": "true" }, "◇"),
      UI.h("b", {}, title),
      sub ? UI.h("p", {}, sub) : null,
      actionBtn || null
    );
  },

  /* 统计卡片 */
  stat({ value, label, color, sub, onClick, ariaLabel }) {
    const el = UI.h("button", { class: "stat", type: "button", "aria-label": ariaLabel || label },
      UI.h("div", { class: "stat-v" + (color ? " " + color : "") }, String(value)),
      UI.h("div", { class: "stat-k" }, label),
      sub ? UI.h("div", { class: "stat-sub" }, sub) : null
    );
    if (onClick) el.addEventListener("click", onClick);
    return el;
  },

  /* 区块标题 */
  sectionTitle(text, extra) {
    return UI.h("div", { class: "sec-title" },
      UI.h("h2", {}, text),
      extra || null
    );
  }
};

/* ---------- 主题 ---------- */
const Theme = {
  mq: window.matchMedia("(prefers-color-scheme: dark)"),
  current() {
    const t = Store.state.settings.theme || "auto";
    return t === "auto" ? (this.mq.matches ? "dark" : "light") : t;
  },
  apply() {
    document.documentElement.dataset.theme = this.current();
    document.querySelector('meta[name="theme-color"]').setAttribute("content", this.current() === "dark" ? "#101425" : "#f5f6fa");
  },
  toggle() {
    Store.state.settings.theme = this.current() === "dark" ? "light" : "dark";
    Store.save(); this.apply();
  },
  init() {
    this.mq.addEventListener("change", () => { if ((Store.state.settings.theme || "auto") === "auto") this.apply(); });
    this.apply();
  }
};

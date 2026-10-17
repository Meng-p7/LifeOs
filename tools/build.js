#!/usr/bin/env node
/* LifeOs 构建脚本（零依赖）：把 src/ 合并为单文件 index.html
 * 用法：node tools/build.js
 * 产物仍是单 HTML——本地双击可用、GitHub Pages 可直接部署 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

const JS_FILES = [
  "src/js/store.js",
  "src/js/ui.js",
  "src/js/charts.js",
  "src/js/sync.js",
  "src/js/timer.js",
  "src/js/views/today.js",
  "src/js/views/tasks.js",
  "src/js/views/study.js",
  "src/js/views/fitness.js",
  "src/js/views/schedule.js",
  "src/js/views/review.js",
  "src/js/views/settings.js",
  "src/js/app.js"
];

let html = read("src/template.html");

const css = read("src/styles.css");
const js = JS_FILES.map(f => "\n/* ================= " + f + " ================= */\n" + read(f)).join("\n");

if (!html.includes("/*__CSS__*/") || !html.includes("/*__JS__*/")) {
  console.error("template.html 缺少 /*__CSS__*/ 或 /*__JS__*/ 占位符");
  process.exit(1);
}
// 用函数形式替换，避免 $ 特殊序列问题
html = html.replace("/*__CSS__*/", () => css).replace("/*__JS__*/", () => js);

const out = path.join(root, "index.html");
fs.writeFileSync(out, html);
console.log("built:", out, (fs.statSync(out).size / 1024).toFixed(1) + "KB");

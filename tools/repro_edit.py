# -*- coding: utf-8 -*-
# 复现：添加任务 → 点编辑 → 改标题 → 点保存 → 是否生效
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="msedge")
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("file:///C:/Users/rain/LifeOs/index.html")
    page.wait_for_selector("#view-today.show", timeout=5000)

    page.click('.nav-item[data-view="tasks"]')
    page.fill("#taskInp", "编辑前标题")
    page.click("#view-tasks button.btn.primary:has-text('添加')")
    page.wait_for_timeout(300)

    page.click("#taskList .task .mini-btn[title='编辑']")
    page.wait_for_timeout(300)
    dlg = page.locator("dialog.modal[open]")
    print("modal open:", dlg.count())
    page.fill("dialog.modal input.inp", "编辑后标题")
    page.click("dialog.modal button[type=submit]")
    page.wait_for_timeout(500)
    print("modal still open:", page.locator("dialog.modal[open]").count())
    print("list has new title:", page.locator("#taskList >> text=编辑后标题").count())
    print("toast:", page.locator("#toast").text_content())
    if errors:
        print("ERRORS:")
        for e in errors: print("  -", e)
    browser.close()

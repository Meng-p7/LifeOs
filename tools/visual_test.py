# -*- coding: utf-8 -*-
# 双端截图：桌面/手机 × 各视图 × 浅/深主题；并检查横向溢出
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

URL = "file:///C:/Users/rain/LifeOs/index.html"
OUT = "C:/Users/rain/LifeOs/shots"
import os
os.makedirs(OUT, exist_ok=True)
issues = []

VIEWS = ["today", "tasks", "study", "fitness", "settings"]

def shoot(page, tag):
    for v in VIEWS:
        if v == "today":
            page.click('.nav-item[data-view="today"]')
        else:
            page.click(f'.nav-item[data-view="{v}"]')
        page.wait_for_timeout(450)
        # 横向溢出检查
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if overflow > 2:
            issues.append(f"{tag}/{v}: horizontal overflow {overflow}px")
        page.screenshot(path=f"{OUT}/{tag}_{v}.png", full_page=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="msedge")
    # 桌面
    page = b.new_page(viewport={"width": 1366, "height": 900})
    page.goto(URL); page.wait_for_selector("#view-today.show", timeout=5000)
    page.wait_for_timeout(1200)  # 等启动动画结束
    shoot(page, "desktop_light")
    page.click("#btnTheme"); page.wait_for_timeout(400)
    shoot(page, "desktop_dark")
    page.close()
    # 手机（iPhone 14 尺寸）
    page = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page.goto(URL); page.wait_for_selector("#view-today.show", timeout=5000)
    page.wait_for_timeout(1200)
    shoot(page, "mobile_light")
    page.click("#btnTheme"); page.wait_for_timeout(400)
    shoot(page, "mobile_dark")
    page.close()
    b.close()

if issues:
    print("ISSUES:")
    for i in issues: print("  -", i)
    sys.exit(1)
print("NO OVERFLOW ISSUES; screenshots in", OUT)

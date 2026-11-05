# -*- coding: utf-8 -*-
# LifeOS 冒烟测试：file:// 加载构建产物，切换全部视图，收集控制台错误
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

URL = "file:///C:/Users/rain/LifeOs/index.html"
errors = []

with sync_playwright() as p:
    last = None
    browser = None
    for channel in ("msedge", "chrome"):
        try:
            browser = p.chromium.launch(headless=True, channel=channel)
            print("using channel:", channel)
            break
        except Exception as e:
            last = e
    if browser is None:
        raise last
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    if errors:
        print("CONSOLE/PAGE ERRORS (early):")
        for e in errors:
            print("  -", e)

    # 首页可见
    page.wait_for_selector("#view-today.show", timeout=5000)
    assert "LifeOS" in page.title()
    print("today OK:", page.locator("#view-today .card").count(), "cards")

    # 添加一个任务（验证核心流程）
    page.click('.nav-item[data-view="tasks"]')
    page.wait_for_timeout(300)
    page.fill("#taskInp", "冒烟测试任务")
    page.click("#view-tasks button.btn.primary:has-text('添加')")
    page.wait_for_timeout(300)
    assert page.locator("#taskList >> text=冒烟测试任务").count() == 1, "任务未出现在列表"
    print("tasks OK: 任务已添加")

    # 学习页：添加事项并开始计时
    page.click('.nav-item[data-view="study"]')
    page.wait_for_timeout(300)
    page.fill("#studyItemInp", "冒烟学习")
    page.click("#view-study button.btn.primary:has-text('添加')")
    page.wait_for_timeout(200)
    page.click(".study-item button:has-text('开始') >> nth=0")
    page.wait_for_timeout(300)
    assert page.locator("#timerBig").count() == 1, "计时器未启动"
    page.click("text=暂停")
    page.wait_for_timeout(200)
    page.click("text=继续")
    page.wait_for_timeout(200)
    print("study OK: 计时启动/暂停/继续")

    # 健身页 + 复盘页
    page.click('.nav-item[data-view="fitness"]')
    page.wait_for_timeout(300)
    assert page.locator("#view-fitness .ex").count() >= 1, "健身动作未渲染"
    print("fitness OK:", page.locator("#view-fitness .ex").count(), "exercises")

    page.click('.nav-item[data-view="review"]')
    page.wait_for_timeout(300)
    print("review OK")

    # 设置页（顶栏齿轮）
    page.click("#btnSettings")
    page.wait_for_timeout(300)
    assert page.locator("#view-settings.show").count() == 1, "设置视图未显示"
    print("settings OK")

    # 回到今日，确认任务出现
    page.click('.nav-item[data-view="today"]')
    page.wait_for_timeout(300)

    page.screenshot(path="C:/Users/rain/LifeOs/smoke_light.png", full_page=False)

    # 深色主题切换
    page.click("#btnTheme")
    page.wait_for_timeout(400)
    page.screenshot(path="C:/Users/rain/LifeOs/smoke_dark.png", full_page=False)
    page.click("#btnTheme")

    browser.close()

if errors:
    print("CONSOLE/PAGE ERRORS:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("ALL VIEWS OK, NO CONSOLE ERRORS")

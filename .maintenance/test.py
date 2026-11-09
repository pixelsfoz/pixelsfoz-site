import os, re, json, threading, http.server, socketserver, traceback, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path(".maintenance/results");out.mkdir(parents=True,exist_ok=True)
production="--production" in sys.argv
base="https://pixelsfoz.com.br" if production else "http://127.0.0.1:8765"
if production:
    ready=False
    for attempt in range(36):
        try:
            with urllib.request.urlopen(urllib.request.Request(base+"/assets/pixels-standard.css?v=20261109",headers={"User-Agent":"Mozilla/5.0"}),timeout=15) as response:
                ready="Pixels shared navigation — 2026-11-09" in response.read().decode()
            if ready:break
        except Exception:pass
        time.sleep(5)
    if not ready:raise RuntimeError("Published version not available yet")
if not production:
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=socketserver.TCPServer(("127.0.0.1",8765),Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
pages=[p.name for p in sorted(Path(".").glob("*.html")) if "<html" in p.read_text().lower()]
expected=["Sobre","Nossa história","ACTION FIGURES","JOGOS PS2","JOGOS PS4","XBOX 360","NINTENDO SWITCH","NINTENDO WII","NINTENDO 3DS","IMPRESSÕES 3D","ANÚNCIOS","Contato","Central de Rifas"]
results=[];errors=[];resources=[];console_errors=[]
def check(condition,message):
    if not condition:raise AssertionError(message)
try:
    with sync_playwright() as p:
        browser=p.chromium.launch()
        for width in ([390,1440] if production else [360,390,768,1440]):
            context=browser.new_context(viewport={"width":width,"height":900},device_scale_factor=1)
            page=context.new_page()
            page.set_default_timeout(8000)
            page.on("pageerror",lambda e:console_errors.append({"url":page.url,"error":str(e),"stack":e.stack}))
            page.on("response",lambda r:resources.append({"url":r.url,"status":r.status}) if r.status>=400 and r.url.startswith(base) and "/api/" not in r.url else None)
            for filename in pages:
                current=filename+" @ "+str(width)
                print("CHECK",current,flush=True)
                try:
                    r=page.goto(base+"/"+filename+"?qa=20261109",wait_until="domcontentloaded",timeout=45000)
                    check(r.status==200,current+": HTTP "+str(r.status))
                    page.evaluate("document.fonts.ready")
                    page.locator(".pixels-brand img").evaluate("(img)=>img.decode()")
                    page.wait_for_timeout(350)
                    for selector in [".raffle-popup-close",".raffle-popup-later"]:
                        popup=page.locator(selector)
                        if popup.count() and popup.is_visible():popup.click()
                    links=page.locator("header [data-pixels-nav] a")
                    check(links.all_text_contents()==expected,current+": menu order")
                    layout=page.evaluate("""()=>({
                      overflow:document.documentElement.scrollWidth>innerWidth+1,
                      logoWidth:document.querySelector('.pixels-brand img').getBoundingClientRect().width,
                      logoHeight:document.querySelector('.pixels-brand img').getBoundingClientRect().height,
                      source:document.querySelector('.pixels-brand img').getAttribute('src'),
                      font:getComputedStyle(document.querySelector('[data-pixels-nav] a')).fontFamily
                    })""")
                    check(not layout["overflow"],current+": horizontal overflow")
                    check(layout["logoWidth"]>=90 and layout["logoWidth"]==layout["logoHeight"],current+": logo size/proportion")
                    check("pixels-logo-" in layout["source"],current+": shared logo")
                    toggle=page.locator("[data-pixels-toggle]")
                    if width<=1180:
                        check(not links.first.is_visible(),current+": menu initially closed")
                        toggle.click()
                        check(toggle.get_attribute("aria-expanded")=="true",current+": menu did not open")
                        check(links.first.is_visible(),current+": links invisible")
                        boxes=links.evaluate_all("(els)=>els.map(e=>({w:e.clientWidth,sw:e.scrollWidth}))")
                        check(all(b["sw"]<=b["w"]+1 for b in boxes),current+": menu text overflow")
                        if filename=="catalogo-3d.html" and width==390:
                            page.screenshot(path=str(out/"3d-mobile-menu.png"))
                        page.keyboard.press("Escape")
                        check(toggle.get_attribute("aria-expanded")=="false",current+": Escape")
                        toggle.click()
                        page.locator("main").click(position={"x":5,"y":500},force=True) if page.locator("main").count() else page.keyboard.press("Escape")
                        # Resize must always reset the menu, regardless of individual page listeners.
                        page.set_viewport_size({"width":1440,"height":900})
                        check(toggle.get_attribute("aria-expanded")=="false",current+": resize")
                        page.set_viewport_size({"width":width,"height":900})
                    else:
                        check(links.first.is_visible(),current+": desktop menu hidden")
                        check(not toggle.is_visible(),current+": desktop toggle visible")
                        if filename=="catalogo-3d.html":page.screenshot(path=str(out/"3d-desktop.png"))
                    if filename=="index.html" and width in [390,1440]:
                        page.screenshot(path=str(out/("home-"+str(width)+".png")))
                    if filename=="catalogo-3d.html" and width in [390,1440]:
                        check(page.locator(".product:visible").count()==12,current+": initial 3D products")
                        page.locator("#search").fill("aranha")
                        check(page.locator(".product:visible").count()>0,current+": 3D search")
                        page.locator("#search").fill("")
                        page.locator("#show-more").click()
                        check(page.locator(".product:visible").count()==24,current+": show more")
                        page.locator(".product:visible [data-open]").first.click()
                        check(page.locator("#product-dialog").evaluate("(d)=>d.open"),current+": details")
                        page.locator("#detail-photo").evaluate("(img)=>img.decode()")
                        page.locator(".dialog-close").click()
                        check(not page.locator("#product-dialog").evaluate("(d)=>d.open"),current+": dialog close")
                    results.append({"page":filename,"width":width,"pass":True,**layout})
                except Exception as e:
                    errors.append({"page":filename,"width":width,"error":str(e)})
                    page.screenshot(path=str(out/("failure-"+filename+"-"+str(width)+".png")))
            context.close()
        # Progressive enhancement: navigation still works without JavaScript.
        context=browser.new_context(java_script_enabled=False,viewport={"width":390,"height":844})
        page=context.new_page();page.goto(base+"/catalogo-3d.html",wait_until="domcontentloaded")
        check(page.locator("[data-pixels-nav] a").first.is_visible(),"No-JS navigation unavailable")
        context.close();browser.close()
except Exception as e:
    errors.append({"fatal":str(e),"trace":traceback.format_exc()})
report={"production":production,"checks":results,"errors":errors,"page_errors":console_errors,"failed_resources":resources}
(out/("production.json" if production else "tests.json")).write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
if errors or console_errors or resources:sys.exit(1)

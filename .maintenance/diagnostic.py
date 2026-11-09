import json, urllib.request, socket
from pathlib import Path
from playwright.sync_api import sync_playwright
report=[]
for host in ["pixelsfoz.com.br","www.pixelsfoz.com.br","cdcb219d.pixelsfoz-page.pages.dev"]:
    record={"host":host}
    try:record["dns"]=socket.gethostbyname_ex(host)
    except Exception as e:record["dns_error"]=str(e)
    for suffix in ["/","/assets/pixels-standard.css?v=20261109"]:
        try:
            req=urllib.request.Request("https://"+host+suffix,headers={"User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req,timeout=12) as r:
                content=r.read()
                record[suffix]={"status":r.status,"url":r.url,"bytes":len(content),"prefix":content[:250].decode(errors="replace")}
        except Exception as e:record[suffix]={"error":str(e)}
    report.append(record)
with sync_playwright() as p:
    browser=p.chromium.launch()
    for item in report:
        page=browser.new_page(viewport={"width":390,"height":844})
        try:
            r=page.goto("https://"+item["host"]+"/catalogo-3d.html",wait_until="domcontentloaded",timeout=20000)
            item["browser"]={"status":r.status,"url":page.url,"title":page.title(),"links":page.locator("[data-pixels-nav] a").all_text_contents(),"logo":page.locator(".pixels-brand img").get_attribute("src") if page.locator(".pixels-brand img").count() else ""}
            page.screenshot(path=".maintenance/results/diagnostic-"+item["host"]+".png")
        except Exception as e:item["browser_error"]=str(e)
        page.close()
    browser.close()
Path(".maintenance/results/diagnostics.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))

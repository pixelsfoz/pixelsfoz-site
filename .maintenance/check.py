import json, re, threading, http.server, os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
out=Path(".maintenance/results")
out.mkdir(parents=True,exist_ok=True)
production=Path(".maintenance/production.txt").exists()
sizes={}
if not production:
    Path("assets/anuncios").mkdir(parents=True,exist_ok=True)
    for system in ("ps4","ps5"):
        source=Path(f"controles-{system}.png")
        target=Path(f"assets/anuncios/controles-{system}.webp")
        with Image.open(source) as im:
            im.convert("RGB").save(target,"WEBP",quality=90,method=6)
            sizes[system]={"dimensions":im.size,"original":source.stat().st_size,"webp":target.stat().st_size}
    html=Path("anuncios-pixels.html").read_text()
    ads=json.loads(re.search(r"const ADS=(\[.*?\]);let categoria",html,re.S)[1])
    baseline=json.loads(Path(".maintenance/old-ads.json").read_text())
    assert ads[2:]==baseline and len(ads)==67
    server=http.server.ThreadingHTTPServer(("127.0.0.1",8765),http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
base="https://pixelsfoz.com.br" if production else "http://127.0.0.1:8765"
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for width in (390,1440):
        page=browser.new_page(viewport={"width":width,"height":900},device_scale_factor=1)
        errors=[]
        page.on("pageerror",lambda error: errors.append(str(error)))
        response=page.goto(base+"/anuncios-pixels.html",wait_until="networkidle")
        assert response.status==200
        assert page.locator(".anuncio-card").count()==67
        page.locator('[data-cat="Acessórios"]').click()
        page.locator("#busca").fill("Controles para")
        assert page.locator(".anuncio-card:visible").count()==2
        for id in (66,67):
            card=page.locator(f'.anuncio-card[data-id="{id}"]')
            card.scroll_into_view_if_needed()
            card.locator("img").evaluate("(img)=>img.decode()")
            assert card.locator("img").evaluate("(img)=>img.naturalWidth>1000")
            assert "wa.me/5545991364519" in card.locator("a.whats").get_attribute("href")
            card.get_by_role("button",name="VER ANÚNCIO",exact=True).click()
            page.locator("#lightboxImg").evaluate("(img)=>img.decode()")
            assert page.locator("#lightbox").evaluate("(e)=>e.classList.contains('aberto')")
            page.screenshot(path=str(out/f"{'live' if production else 'local'}-{width}-{id}.png"))
            page.keyboard.press("Escape")
            assert not page.locator("#lightbox").evaluate("(e)=>e.classList.contains('aberto')")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+1")
        page.locator("#busca").fill("")
        page.locator('[data-cat="Todos"]').click()
        assert page.locator(".anuncio-card:visible").count()==67
        assert not errors, errors
        checks.append({"width":width,"cards":67,"filter":True,"posters":True,"modal":True,"whatsapp":True,"jsErrors":errors})
        page.close()
    browser.close()
(out/("production.json" if production else "local.json")).write_text(json.dumps({"passed":True,"base":base,"sizes":sizes,"checks":checks},indent=2))
print("ALL CHECKS PASSED",base,flush=True)

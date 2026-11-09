from pathlib import Path
import re, json, base64, hashlib, io
from PIL import Image, ImageOps
from fontTools.ttLib import TTFont

ROOT=Path(".")
OUT=ROOT/"assets/optimized"
OUT.mkdir(parents=True,exist_ok=True)
REPORT=ROOT/".maintenance/results"
REPORT.mkdir(parents=True,exist_ok=True)
version="20261109"
items=[
 ("index.html#sobre","Sobre"),("index.html#historia","Nossa história"),
 ("catalogo-pixels.html","ACTION FIGURES"),("catalogo-ps2.html","JOGOS PS2"),
 ("catalogo-ps4.html","JOGOS PS4"),("catalogo-xbox360.html","XBOX 360"),
 ("catalogo-nintendo-switch-pixels.html","NINTENDO SWITCH"),
 ("catalogo-nintendo-wii.html","NINTENDO WII"),("catalogo-nintendo-3ds.html","NINTENDO 3DS"),
 ("catalogo-3d.html","IMPRESSÕES 3D"),("anuncios-pixels.html","ANÚNCIOS"),
 ("index.html#contato","Contato"),("central-rifas.html","Central de Rifas")
]
# Original supplied artwork, without recoloring, redrawing or cropping.
logo=Image.open("assets/logos/official-round-1.png").convert("RGBA")
logo.thumbnail((320,320),Image.Resampling.LANCZOS)
buffer=io.BytesIO();logo.save(buffer,"WEBP",quality=95,method=6)
blob=buffer.getvalue()
logo_path=OUT/("pixels-logo-"+hashlib.sha256(blob).hexdigest()[:16]+".webp")
logo_path.write_bytes(blob)
font_css=[]
for source in sorted(Path("assets/fonts").glob("pixels-font-*.ttf")):
    font=TTFont(source);font.flavor="woff2"
    dest=OUT/(source.stem+"-"+hashlib.sha256(source.read_bytes()).hexdigest()[:12]+".woff2")
    font.save(dest)
    number=int(source.stem.rsplit("-",1)[1])
    family="Press Start 2P" if number==0 else "Rubik"
    weight={0:400,1:400,2:500,3:700}[number]
    font_css.append("@font-face{font-family:'"+family+"';font-style:normal;font-weight:"+str(weight)+";font-display:swap;src:url(optimized/"+dest.name+") format('woff2')}")
assert len(font_css)==4
Path("assets/pixels-fonts.css").write_text("\n".join(font_css)+"\n")
uri_pattern=re.compile(r"data:image/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)")
cache={};asset_report=[]
def extract(m):
    uri=m.group(0)
    if uri in cache:return cache[uri]
    data=base64.b64decode(m.group(2),validate=True)
    ext={"jpeg":"jpg","svg+xml":"svg"}.get(m.group(1).lower(),m.group(1).lower())
    optimized=data
    try:
        image=Image.open(io.BytesIO(data))
        if not getattr(image,"is_animated",False):
            image=ImageOps.exif_transpose(image)
            if image.mode not in ("RGB","RGBA"):image=image.convert("RGBA" if "transparency" in image.info else "RGB")
            image.thumbnail((1920,1920),Image.Resampling.LANCZOS)
            b=io.BytesIO();image.save(b,"WEBP",quality=88,method=6)
            if len(b.getvalue())<len(data):optimized=b.getvalue();ext="webp"
    except (OSError,ValueError):pass
    dest=OUT/(hashlib.sha256(optimized).hexdigest()[:24]+"."+ext)
    dest.write_bytes(optimized)
    cache[uri]=dest.as_posix()
    asset_report.append({"source_bytes":len(data),"output_bytes":len(optimized),"path":str(dest)})
    return str(dest)
reports=[]
for file in sorted(ROOT.glob("*.html")):
    raw=file.read_text(encoding="utf-8")
    if not re.search(r"<html\b",raw,re.I):continue
    before=len(raw.encode())
    old_header=re.search(r"<header\b[\s\S]*?</header>",raw,re.I)
    assert old_header and "data-pixels-nav" in old_header[0],file.name
    old=old_header[0]
    toggle=re.search(r"<button\b[^>]*data-pixels-toggle[^>]*>",old)[0]
    control=re.search(r'aria-controls=["\']([^"\']+)',toggle)
    navid=control[1]
    toggle=re.sub(r'aria-expanded=["\'][^"\']*["\']','aria-expanded="false"',toggle)
    toggle=re.sub(r'aria-label=["\'][^"\']*["\']','aria-label="Abrir menu"',toggle)
    if "aria-label=" not in toggle:toggle=toggle[:-1]+' aria-label="Abrir menu">'
    if "type=" not in toggle:toggle=toggle[:-1]+' type="button">'
    old_nav=re.search(r'<(?:ul|div|nav)\b[^>]*data-pixels-nav[^>]*>',old)[0]
    old_class=re.search(r'class=["\']([^"\']*)',old_nav)
    navclass=(' class="'+old_class[1]+'"') if old_class else ""
    links="".join('<li><a href="'+href+'"'+(' aria-current="page"' if href==file.name else '')+'>'+label+'</a></li>' for href,label in items)
    header='<header class="pixels-site-header"><div class="pixels-header-inner"><a class="pixels-brand" href="index.html" aria-label="Pixels — página inicial"><img src="'+str(logo_path)+'" alt="Pixels Real Acessórios" width="320" height="320" fetchpriority="high" decoding="async"></a>'+toggle+'<span aria-hidden="true">☰</span> MENU</button><ul id="'+navid+'"'+navclass+' data-pixels-nav aria-label="Navegação principal">'+links+'</ul></div></header>'
    raw=raw[:old_header.start()]+header+raw[old_header.end():]
    # Replace embedded image payloads with independently cached image resources.
    raw=uri_pattern.sub(extract,raw)
    # Avoid applying HTML rewrites to JavaScript strings/templates.
    chunks=re.split(r"(<script\b[\s\S]*?</script>|<style\b[\s\S]*?</style>)",raw,flags=re.I)
    image_index=0
    for i,chunk in enumerate(chunks):
        if re.match(r"<(?:script|style)\b",chunk,re.I):continue
        chunk=re.sub(r'<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>',"",chunk)
        chunk=re.sub(r'<link\b[^>]*href=["\']assets/navigation\.css[^"\']*["\'][^>]*>',"",chunk)
        chunk=re.sub(r'assets/pixels-standard\.css(?:\?[^"\']*)?',f'assets/pixels-standard.css?v={version}',chunk)
        if 'assets/pixels-fonts.css' not in chunk and "</head>" in chunk:
            chunk=chunk.replace("</head>",f'<link rel="stylesheet" href="assets/pixels-fonts.css?v={version}">\n</head>')
        def image_tag(m):
            global image_index
            tag=m[0];image_index+=1
            if "decoding=" not in tag:tag=tag.replace("<img",'<img decoding="async"',1)
            if "loading=" not in tag and "fetchpriority=" not in tag and image_index>3:
                tag=tag.replace("<img",'<img loading="lazy"',1)
            return tag
        chunk=re.sub(r"<img\b[^>]*>",image_tag,chunk,flags=re.I)
        # Only the Action Figures destination is renamed; other catalog content is retained.
        chunk=re.sub(r'(<a\b[^>]*href=["\']catalogo-pixels\.html["\'][^>]*>)\s*CATÁLOGO\s*(</a>)',r'\1ACTION FIGURES\2',chunk,flags=re.I)
        chunks[i]=chunk
    raw="".join(chunks)
    # Invalidate the shared script in existing browser caches.
    raw=re.sub(r'(<script\b[^>]*src=["\'])assets/navigation\.js(?:\?[^"\']*)?',r'\1assets/navigation.js?v='+version,raw)
    file.write_text(raw,encoding="utf-8")
    reports.append({"page":file.name,"before":before,"after":len(raw.encode())})
# The 3D catalog keeps its catalog/gallery logic; the common script owns the menu.
p=Path("assets/catalogo-3d/catalogo.js");js=p.read_text()
start=js.index("  const menu = document.querySelector('.menu-toggle')")
end=js.index("  const dialog =",start)
js=js[:start]+js[end:]
p.write_text(js)
# Scope obsolete generic nav styles to the old header only, preventing interference
# with the shared header and other navigation components.
p=Path("assets/catalogo-3d/catalogo.css");css=p.read_text()
css=re.sub(r"(?<![\w-])nav(?=[\s.{,:])",".site-header nav",css)
p.write_text(css)
# Use the existing lighter hero asset.
p=Path("catalogo-3d.html");html=p.read_text()
html=html.replace('src="assets/catalogo-3d/homem-aranha-170cm.jpg"','src="assets/catalogo-3d/homem-aranha-170cm.webp"',1)
html=html.replace('assets/catalogo-3d/catalogo.js"','assets/catalogo-3d/catalogo.js?v='+version+'"')
html=html.replace('assets/catalogo-3d/catalogo.css"','assets/catalogo-3d/catalogo.css?v='+version+'"')
p.write_text(html)
headers=Path("_headers")
existing=headers.read_text() if headers.exists() else ""
headers.write_text(existing+"\n/assets/optimized/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/pixels-standard.css\n  Cache-Control: public, max-age=0, must-revalidate\n/assets/navigation.js\n  Cache-Control: public, max-age=0, must-revalidate\n")
summary={"pages":reports,"images":len(asset_report),"source_image_bytes":sum(a["source_bytes"] for a in asset_report),"optimized_image_bytes":sum(a["output_bytes"] for a in asset_report),"logo":str(logo_path),"logo_bytes":len(blob),"navigation":[label for href,label in items]}
(REPORT/"optimization.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False,indent=2))

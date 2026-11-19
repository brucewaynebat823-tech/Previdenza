"""Esplora i dati pubblici COVIP: elenca i link scaricabili e mostra la struttura dei file.
Solo lettura; non modifica nulla. Uso: python scripts/esplora-covip.py"""
import re, sys, urllib.request, urllib.parse, io, os

BASE = "https://www.covip.it"
PAGINE = [
    "/open-data",
    "/per-gli-operatori/fondi-pensione/costi-e-rendimenti-dei-fondi-pensione/elenco-dei-rendimenti",
    "/per-gli-operatori/fondi-pensione/costi-e-rendimenti-dei-fondi-pensione/valori-medi-degli-isc",
]
UA = "Previdenza-PWA-esplora/0.1 (dati aperti COVIP, uso personale)"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, dict(r.headers), r.read()

link = set()
for p in PAGINE:
    url = BASE + p
    try:
        st, h, body = get(url)
        print(f"[OK {st}] {url} ({len(body)} byte) Last-Modified={h.get('Last-Modified')}")
        txt = body.decode("utf-8", "replace")
        for m in re.findall(r'href="([^"]+\.(?:xlsx?|csv|json|ods|zip))"', txt, re.I):
            link.add(urllib.parse.urljoin(url, m))
    except Exception as e:
        print(f"[ERRORE] {url}: {e}")

print("\n== Link a file dati trovati ==")
for l in sorted(link):
    print(l)

try:
    import openpyxl
except ImportError:
    openpyxl = None

os.makedirs("esplora", exist_ok=True)
for l in sorted(link):
    try:
        st, h, body = get(l)
    except Exception as e:
        print(f"\n[ERRORE download] {l}: {e}")
        continue
    print(f"\n### {l}\n  stato={st} byte={len(body)} tipo={h.get('Content-Type')} Last-Modified={h.get('Last-Modified')}")
    nome = os.path.join("esplora", os.path.basename(urllib.parse.urlparse(l).path))
    open(nome, "wb").write(body)
    if l.lower().endswith((".xlsx", ".xlsm")) and openpyxl:
        wb = openpyxl.load_workbook(io.BytesIO(body), read_only=True, data_only=True)
        for ws in wb.worksheets:
            print(f"  foglio '{ws.title}' dim={ws.max_row}x{ws.max_column}")
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i >= 8: break
                print("   ", [c for c in row][:14])

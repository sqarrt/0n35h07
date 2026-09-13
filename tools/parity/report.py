#!/usr/bin/env python3
"""Build self-contained HTML parity reports (web reference -> Godot port) from a stage spec.

Usage: python3 tools/parity/report.py tools/parity/stages/<stage>.json

Every run writes a NEW report to test-results/parity-reports/<stage id>-<YYYYMMDD-HHMMSS>/ (never overwrites):
  index.html      every page of the stage, full standalone document
  <slug>.html     one standalone document per page (menu, lobby, match, ...)
  artifact.html   the combined report as a body fragment (publish it as a NEW Artifact each time)
Screenshots and fonts are embedded as data URIs, so every file opens offline on its own.
"""
import base64
import html
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
STAMP_FORMAT = "%Y%m%d-%H%M%S"
OUT_ROOT = REPO / "test-results" / "parity-reports"
FONT_LATIN = REPO / "web-reference/node_modules/@fontsource/share-tech-mono/files/share-tech-mono-latin-400-normal.woff2"
FONT_CYRILLIC = REPO / "web-reference/src/ui/fonts/share-tech-mono-cyrillic.ttf"
BODY_FONT_URL = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
CYRILLIC_RANGE = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"

SEVERITY = {
    "missing": "нет функции",
    "behavior": "поведение",
    "visual": "визуал",
    "platform": "не дефект",
    "fixed": "исправлено",
}
EVIDENCE = {"screenshot": "скриншот", "code": "код", "test": "тест", "runtime": "запуск"}
KIND_LABEL = {"web": "WEB · эталон", "godot": "GODOT · порт"}
INLINE_CODE = re.compile(r"`([^`]+)`")


def text(value: str) -> str:
    """Escape spec text; `backticks` become <code>."""
    return INLINE_CODE.sub(lambda m: f"<code>{m.group(1)}</code>", html.escape(value))


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=REPO, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return "?"


def font_faces() -> str:
    faces = []
    if FONT_LATIN.exists():
        faces.append(f"@font-face{{font-family:'Share Tech Mono';font-weight:400;font-display:swap;"
                     f"src:url({data_uri(FONT_LATIN, 'font/woff2')}) format('woff2');}}")
    if FONT_CYRILLIC.exists():
        faces.append(f"@font-face{{font-family:'Share Tech Mono';font-weight:400;font-display:swap;"
                     f"src:url({data_uri(FONT_CYRILLIC, 'font/ttf')}) format('truetype');"
                     f"unicode-range:{CYRILLIC_RANGE};}}")
    return "\n".join(faces)


CSS = """
:root{
  --bg:#0a0c11; --panel:#0d1219; --panel-2:#111823; --line:#1a2433; --line-2:#26354a;
  --text:#dcebfb; --body:#b4c3d3; --muted:#7c899a;
  --web:#44aaff; --godot:#44ffaa; --bracket:#3b5fd0;
  --sev-missing:#ff6b6b; --sev-behavior:#ffaa44; --sev-visual:#c8a2ff; --sev-platform:#7c899a;
  --mono:'Share Tech Mono','Consolas','DejaVu Sans Mono',monospace;
  --sans:'IBM Plex Sans','Segoe UI',Roboto,system-ui,sans-serif;
  color-scheme:dark;
}
*{box-sizing:border-box}
html,body{background:var(--bg);color:var(--body)}
body{margin:0;font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:1200px;margin:0 auto;padding-inline:20px;padding-block:28px 72px;display:grid;gap:56px}
h1,h2,h3{font-family:var(--mono);font-weight:400;color:var(--text);text-wrap:balance;margin:0;letter-spacing:.04em}
h1{font-size:clamp(28px,4.4vw,42px);line-height:1.15}
h2{font-size:clamp(22px,3vw,30px);line-height:1.2}
h3{font-size:15px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
h3::before{content:'// ';color:var(--line-2)}
p{margin:0;max-width:68ch}
code{font-family:var(--mono);font-size:.9em;color:var(--text);background:var(--panel-2);border:1px solid var(--line);
  padding:0 .35em;border-radius:3px;overflow-wrap:anywhere}
a{color:var(--web)}
a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--web);outline-offset:2px}

/* HUD-style corner brackets, as in the game's in-match frame */
.brackets{position:relative}
.brackets::before,.brackets::after{content:'';position:absolute;width:34px;height:34px;pointer-events:none}
.brackets::before{left:0;top:0;border-left:3px solid var(--bracket);border-top:3px solid var(--bracket)}
.brackets::after{right:0;bottom:0;border-right:3px solid var(--bracket);border-bottom:3px solid var(--bracket)}

.masthead{padding:30px 30px 26px;display:grid;gap:18px;background:linear-gradient(180deg,var(--panel),transparent)}
.eyebrow{font-family:var(--mono);font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:var(--web)}
.lede{font-size:17px;color:var(--body)}
.meta{display:flex;flex-wrap:wrap;gap:8px 22px;font-family:var(--mono);font-size:13px;color:var(--muted)}
.meta b{color:var(--text);font-weight:400}

.tally{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:12px;letter-spacing:.08em;
  text-transform:uppercase;padding:2px 9px;border:1px solid currentColor;border-radius:3px;white-space:nowrap;line-height:1.6}
.chip i{font-style:normal;color:var(--text)}
.sev-missing{color:var(--sev-missing)} .sev-behavior{color:var(--sev-behavior)}
.sev-visual{color:var(--sev-visual)} .sev-platform{color:var(--sev-platform)}
.sev-fixed{color:var(--sev-fixed,#4fa)}

.toc{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.toc a{display:grid;gap:10px;padding:16px 18px;background:var(--panel);border:1px solid var(--line);text-decoration:none;color:var(--body)}
.toc a:hover{border-color:var(--web)}
.toc .name{font-family:var(--mono);font-size:19px;color:var(--text)}
.toc .verdict{font-size:14px;color:var(--muted)}

.legend{display:grid;gap:8px;font-size:14px;color:var(--muted)}
.legend ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px 18px}
.legend li{display:flex;gap:8px;align-items:center}

.stage{display:grid;gap:30px;scroll-margin-top:16px}
.stage-head{display:grid;gap:12px;padding-bottom:18px;border-bottom:1px solid var(--line)}
.stage-head .verdict{font-size:17px;color:var(--text)}
.block{display:grid;gap:14px}

.table-scroll{overflow-x:auto;border:1px solid var(--line)}
table{border-collapse:collapse;width:100%;min-width:640px;font-size:14px}
th,td{padding:9px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
tr:last-child td{border-bottom:0}
thead th{font-family:var(--mono);font-weight:400;font-size:12px;letter-spacing:.14em;text-transform:uppercase;background:var(--panel-2)}
thead th.web{color:var(--web)} thead th.godot{color:var(--godot)} thead th.param{color:var(--muted)}
td.param{font-family:var(--mono);color:var(--muted);white-space:nowrap}

.pair{display:grid;gap:12px}
.pair-bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px}
.pair-title{font-family:var(--mono);color:var(--text);font-size:16px}
.modes{display:inline-flex;border:1px solid var(--line-2)}
.modes button{font:12px var(--mono);letter-spacing:.1em;text-transform:uppercase;background:transparent;color:var(--muted);
  border:0;padding:5px 12px;cursor:pointer}
.modes button[aria-pressed="true"]{background:var(--web);color:#06121f}
.panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.pair[data-mode="stack"] .panels{grid-template-columns:minmax(0,1fr)}
.pair[data-mode="wipe"] .panels{display:none}
.panel{display:grid;gap:8px;align-content:start}
.panel-label{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:13px;letter-spacing:.14em}
.panel-label::before{content:'';width:10px;height:10px;background:currentColor}
.kind-web{color:var(--web)} .kind-godot{color:var(--godot)}
.shot{padding:6px;background:#05070a;border:1px solid var(--line)}
.shot img{display:block;width:100%;height:auto;max-width:100%}
.absent{aspect-ratio:16/9;max-width:100%;display:grid;place-content:center;gap:6px;text-align:center;padding:18px;
  border:1px dashed var(--line-2);color:var(--muted);font-size:14px;background:repeating-linear-gradient(135deg,transparent 0 12px,rgba(68,255,170,.03) 12px 24px)}
.absent strong{font-family:var(--mono);font-weight:400;color:var(--godot);letter-spacing:.12em;text-transform:uppercase;font-size:13px}
.panel-note{font-size:14px;color:var(--muted)}
.wipe{display:none;gap:10px}
.pair[data-mode="wipe"] .wipe{display:grid}
.wipe-stage{position:relative;padding:6px;background:#05070a;border:1px solid var(--line)}
.wipe-stage img{display:block;width:100%;height:auto}
.wipe-top{position:absolute;inset:6px;overflow:hidden;clip-path:inset(0 calc(100% - var(--cut,50%)) 0 0)}
.wipe-top img{width:100%}
.wipe-line{position:absolute;top:6px;bottom:6px;left:calc(6px + (100% - 12px) * var(--cut-frac,.5));width:2px;background:var(--text);opacity:.8}
.wipe-ctl{display:flex;align-items:center;gap:12px;font:13px var(--mono);color:var(--muted)}
.wipe-ctl input{flex:1;accent-color:var(--web)}

.issues{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.issue{display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px 22px;padding:18px 0;border-bottom:1px solid var(--line)}
.issue-id{display:grid;gap:8px;align-content:start;justify-items:start}
.issue-id .num{font-family:var(--mono);font-size:22px;color:var(--text)}
.issue-body{display:grid;gap:10px}
.issue-title{font-weight:600;color:var(--text);font-size:17px}
.sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 20px}
.side{display:grid;gap:2px;font-size:15px}
.side span{font-family:var(--mono);font-size:12px;letter-spacing:.14em}
.issue-foot{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;font-size:13px;color:var(--muted)}
.issue-foot .ev{font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;color:var(--body)}
.issue-foot code{font-size:12px}

.limits{margin:0;padding-left:20px;display:grid;gap:8px;max-width:80ch}
.limits li::marker{color:var(--sev-behavior)}
.footer{font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:18px}

@media (max-width:760px){
  .panels,.sides{grid-template-columns:minmax(0,1fr)}
  .issue{grid-template-columns:minmax(0,1fr)}
  .issue-id{grid-auto-flow:column;align-items:center;justify-content:start}
  .masthead{padding:22px 18px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
"""

SCRIPT = """
document.querySelectorAll('.pair').forEach((pair) => {
  const buttons = pair.querySelectorAll('.modes button');
  buttons.forEach((b) => b.addEventListener('click', () => {
    pair.dataset.mode = b.dataset.mode;
    buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  const range = pair.querySelector('.wipe-ctl input');
  const stage = pair.querySelector('.wipe-stage');
  if (range && stage) {
    const apply = () => {
      stage.style.setProperty('--cut', range.value + '%');
      stage.style.setProperty('--cut-frac', String(range.value / 100));
    };
    range.addEventListener('input', apply);
    apply();
  }
});
"""


def panel_html(panel: dict, images: dict) -> str:
    kind = panel["kind"]
    label = html.escape(panel.get("label", KIND_LABEL[kind]))
    if panel.get("img"):
        body = f'<div class="shot"><img src="{images[panel["img"]]}" alt="{html.escape(panel.get("alt", label))}" loading="lazy"></div>'
    else:
        body = (f'<div class="absent"><strong>{html.escape(panel.get("absent_title", "кадра нет"))}</strong>'
                f'<span>{text(panel.get("absent", ""))}</span></div>')
    note = f'<p class="panel-note">{text(panel["note"])}</p>' if panel.get("note") else ""
    return f'<figure class="panel" style="margin:0"><figcaption class="panel-label kind-{kind}">{label}</figcaption>{body}{note}</figure>'


def pair_html(pair: dict, images: dict, uid: str) -> str:
    panels = pair["panels"]
    both_shots = len(panels) == 2 and all(p.get("img") for p in panels)
    modes = [("side", "рядом"), ("stack", "крупно")]
    wipe = ""
    if both_shots and pair.get("wipe"):
        modes.append(("wipe", "шторка"))
        bottom, top = panels[1], panels[0]
        wipe = (f'<div class="wipe"><div class="wipe-stage"><img src="{images[bottom["img"]]}" alt="">'
                f'<div class="wipe-top"><img src="{images[top["img"]]}" alt=""></div><div class="wipe-line"></div></div>'
                f'<label class="wipe-ctl" for="{uid}-cut"><span class="kind-{bottom["kind"]}">{html.escape(bottom.get("label", KIND_LABEL[bottom["kind"]]))}</span>'
                f'<input id="{uid}-cut" type="range" min="0" max="100" value="50">'
                f'<span class="kind-{top["kind"]}">{html.escape(top.get("label", KIND_LABEL[top["kind"]]))}</span></label></div>')
    buttons = "".join(f'<button type="button" data-mode="{m}" aria-pressed="{str(i == 0).lower()}">{n}</button>'
                      for i, (m, n) in enumerate(modes))
    note = f'<p class="panel-note">{text(pair["note"])}</p>' if pair.get("note") else ""
    return (f'<div class="pair" data-mode="side"><div class="pair-bar"><span class="pair-title">{text(pair["title"])}</span>'
            f'<span class="modes" role="group" aria-label="Режим сравнения">{buttons}</span></div>'
            f'<div class="panels">{"".join(panel_html(p, images) for p in panels)}</div>{wipe}{note}</div>')


def tally_html(issues: list) -> str:
    counts = {k: 0 for k in SEVERITY}
    for i in issues:
        counts[i["severity"]] += 1
    return "".join(f'<span class="chip sev-{k}">{SEVERITY[k]} <i>{n}</i></span>' for k, n in counts.items() if n)


def issue_html(issue: dict) -> str:
    sev = issue["severity"]
    evidence = " · ".join(EVIDENCE[e] for e in issue.get("evidence", []))
    sources = " ".join(f"<code>{html.escape(s)}</code>" for s in issue.get("sources", []))
    return (f'<li class="issue"><div class="issue-id"><span class="num">{html.escape(issue["id"])}</span>'
            f'<span class="chip sev-{sev}">{SEVERITY[sev]}</span></div>'
            f'<div class="issue-body"><div class="issue-title">{text(issue["title"])}</div>'
            f'<div class="sides"><div class="side"><span class="kind-web">WEB</span><p>{text(issue["web"])}</p></div>'
            f'<div class="side"><span class="kind-godot">GODOT</span><p>{text(issue["godot"])}</p></div></div>'
            f'<div class="issue-foot"><span class="ev">подтверждено: {evidence}</span>{sources}</div></div></li>')


def conditions_html(rows: list) -> str:
    body = "".join(f'<tr><td class="param">{html.escape(r[0])}</td><td>{text(r[1])}</td><td>{text(r[2])}</td></tr>' for r in rows)
    return ('<div class="table-scroll"><table><thead><tr><th class="param">параметр</th><th class="web">web · эталон</th>'
            f'<th class="godot">godot · порт</th></tr></thead><tbody>{body}</tbody></table></div>')


def page_html(page: dict, images: dict) -> str:
    slug = page["slug"]
    pairs = "".join(pair_html(p, images, f"{slug}-{n}") for n, p in enumerate(page.get("comparisons", [])))
    issues = "".join(issue_html(i) for i in page["discrepancies"])
    limits = "".join(f"<li>{text(l)}</li>" for l in page.get("limitations", []))
    return (f'<section class="stage" id="{slug}"><header class="stage-head"><span class="eyebrow">этап сверки · {html.escape(slug)}</span>'
            f'<h2>{html.escape(page["name"])}</h2><p class="verdict">{text(page["verdict"])}</p>'
            f'<div class="tally">{tally_html(page["discrepancies"])}</div></header>'
            f'<div class="block"><h3>условия съёмки</h3>{conditions_html(page["conditions"])}</div>'
            f'<div class="block"><h3>сравнение кадров</h3>{pairs}</div>'
            f'<div class="block"><h3>подтверждённые расхождения · {len(page["discrepancies"])}</h3><ol class="issues">{issues}</ol></div>'
            f'<div class="block"><h3>ограничения проверки</h3><ul class="limits">{limits}</ul></div></section>')


def legend_html() -> str:
    items = "".join(f'<li><span class="chip sev-{k}">{v}</span></li>' for k, v in SEVERITY.items())
    return (f'<div class="legend"><ul>{items}</ul><p>«Нет функции» — в Godot отсутствует целиком; «поведение» — есть, но работает иначе; '
            f'«визуал» — работает, но выглядит иначе; «не дефект» — осознанное платформенное отличие.</p></div>')


def document(spec: dict, pages: list, images: dict, meta: dict, fragment: bool) -> str:
    toc = ""
    if len(pages) > 1:
        toc = "<nav class=toc aria-label='Этапы'>" + "".join(
            f'<a href="#{p["slug"]}"><span class="name">{html.escape(p["name"])}</span>'
            f'<span class="verdict">{text(p["verdict_short"])}</span><span class="tally">{tally_html(p["discrepancies"])}</span></a>'
            for p in pages) + "</nav>"
    title = spec["title"] if len(pages) > 1 else f'{pages[0]["name"]} · {spec["title"]}'
    head = (f'<title>{html.escape(title)}</title>'
            f'<link rel="stylesheet" href="{BODY_FONT_URL}"><style>{font_faces()}{CSS}</style>')
    body = (f'<main class="wrap"><header class="masthead brackets"><span class="eyebrow">// паритет · web → godot</span>'
            f'<h1>{html.escape(spec["title"])}</h1><p class="lede">{text(spec["lede"])}</p>'
            f'<div class="meta"><span>дата <b>{html.escape(spec["date"])}</b></span><span>ветка <b>{html.escape(meta["branch"])}</b></span>'
            f'<span>HEAD <b>{html.escape(meta["head"])}</b>{" + незакоммиченные правки" if meta["dirty"] else ""}</span>'
            f'<span>снимки <b>{html.escape(spec["captures_dir"])}</b></span></div>{legend_html()}</header>'
            f'{toc}{"".join(page_html(p, images) for p in pages)}'
            f'<footer class="footer">{text(spec["footer"])}</footer></main><script>{SCRIPT}</script>')
    if fragment:
        return head + body
    return f'<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">{head}</head><body>{body}</body></html>'


def main() -> None:
    spec_path = Path(sys.argv[1]).resolve()
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    captures = REPO / spec["captures_dir"]
    images = {}
    for page in spec["pages"]:
        for pair in page.get("comparisons", []):
            for panel in pair["panels"]:
                if panel.get("img") and panel["img"] not in images:
                    images[panel["img"]] = data_uri(captures / panel["img"], "image/png")
    meta = {"branch": git("rev-parse", "--abbrev-ref", "HEAD"), "head": git("rev-parse", "--short", "HEAD"),
            "dirty": git("status", "--porcelain", "--untracked-files=no") not in ("", "?")}
    # Every run is a NEW report: a timestamped folder, never an overwrite of an earlier one.
    out = OUT_ROOT / f'{spec["id"]}-{datetime.now().strftime(STAMP_FORMAT)}'
    if out.exists():
        sys.exit(f"Report {out} already exists; reports are never overwritten — run again in a second.")
    out.mkdir(parents=True)
    (out / "index.html").write_text(document(spec, spec["pages"], images, meta, False), encoding="utf-8")
    (out / "artifact.html").write_text(document(spec, spec["pages"], images, meta, True), encoding="utf-8")
    for page in spec["pages"]:
        (out / f'{page["slug"]}.html').write_text(document(spec, [page], images, meta, False), encoding="utf-8")
    print(f"REPORT {out}")


if __name__ == "__main__":
    main()

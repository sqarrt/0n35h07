// Oracle for the Godot port's CSS line breaking: asks Chromium itself where a soft wrap opportunity lies between two
// characters. Blink breaks ASCII text by a fixed pair table (its fast path), so every pair of printable ASCII characters
// plus the non-ASCII ones the Radio's programs use is laid out alone in a 1 px wide pre-wrap box — the second character
// drops to a new line exactly when the pair may break. Writes the Godot project's assets/text/chrome_line_breaks.json
// (CssPreWrap reads it at run time): the characters and one row per first character, "1" where a break may come before
// the second.
//   node scripts/export-chrome-line-breaks.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../assets/text/chrome_line_breaks.json')
const FIRST_PRINTABLE = 0x21
const LAST_PRINTABLE = 0x7e
const EXTRA = ['·', '—', '→', '←']   // the programs' comment separators and arrows

const chars = []
for (let code = FIRST_PRINTABLE; code <= LAST_PRINTABLE; code++) chars.push(String.fromCharCode(code))
chars.push(...EXTRA)

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent('<div id="box" style="width:1px;white-space:pre-wrap;overflow-wrap:normal;word-break:normal;' +
    'line-break:auto;font:16px monospace"></div>')
  const rows = await page.evaluate(list => {
    const box = document.getElementById('box')
    const range = document.createRange()
    return list.map(first => list.map(second => {
      box.textContent = first + second
      const node = box.firstChild
      range.setStart(node, 0); range.setEnd(node, 1)
      const a = range.getClientRects()[0]
      range.setStart(node, 1); range.setEnd(node, 2)
      const b = range.getClientRects()[0]
      return b.top > a.top + 1 ? '1' : '0'
    }).join(''))
  }, chars)
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify({ chars: chars.join(''), rows }, null, 1) + '\n')
  const breaks = rows.reduce((n, row) => n + [...row].filter(c => c === '1').length, 0)
  console.log(`chrome line breaks: ${chars.length} characters, ${breaks} breakable pairs -> ${OUT}`)
} finally {
  await browser.close()
}

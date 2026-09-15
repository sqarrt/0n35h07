// Helper prelude evaluated once at engine init. Ported from the project owner's
// Strudel helper library (brebake.strudel), including the wavetable voices
// (roller/spinor/roller2) and a no-op slider() shim. Excluded on purpose: MIDI
// (voc), DOM (UISlider), and anything that assigns an orbit — the `o` alias,
// `mpan`, and brebake's `.o(8)` `zap` — since the director owns orbit routing.
//
// Lives here as Strudel source so the transpiler parses mini-notation strings the
// same way the owner's REPL does. It is evaluated through @strudel/web, so all of
// register/Pattern/reify/stack/etc. are in scope.

export const PRELUDE_CODE = String.raw`
// --- registration shim: expose a helper in both function and mini-notation scope
window.registerFunc = (name, func) => {
  strudelScope[name] = func
  window[name] = func
}

setGainCurve(x => Math.pow(x, 2))
setDefault('gain', 1)

// --- postgain
register('pg', (pgain, x) => x.mul(postgain(pgain)))

// --- FM voice (DX7-ish). default Strudel sine + fm
window.DX = (env = 8, fm = 2, harm = 2) => s("sine")
  .fm(fm).fmenv(env).fmh(harm).fmdecay(.2)

// --- tb303-style filter envelope, 0..1 useful range. Matches the owner's REPL
// prebake EXACTLY: lps(.2) sustain, no filter attack, lpq(2) — a smoother, less
// resonant/screechy acid than a higher Q. (Earlier we drifted to lpa(.1)/lpq(5),
// which made every acid voice harsher than the reference.)
register('acidenv', (x, pat) => pat.lpf(100)
  .lpenv(x * 9).lps(.2).lpd(.12).lpq(2)
)

// --- accent: velocity + filter pop on accented steps
register('accent', (accent, pat) => {
  if (accent == 0) return pat
  return pat.mul(velocity(1 + (accent / 8)))
    .mul(lpenv(1 + (accent / 5))).lpd(.13).lpa(.01)
})

// --- octave: transpose relative to octave 3
register('octave', (oct, pat) => pat.transpose((oct - 3) * 12))

// --- noise hat / zap, built-in white & sine
registerFunc('noisehat', (seg = 16, modu = tri, speed = 4, min = .05, max = .12) =>
  s('white').seg(seg).dec(modu.fast(speed).range(min, max)))
registerFunc('zap', (amount = .8, speed = .1, note = 'c3') =>
  s("sine").penv(reify(amount).mul(120)).note(note).pdec(speed).dec(speed))

// --- scale state: stems use .sc() relative to the director-set global scale
window.SCALE = 'c:minor'
window.setScale = (sc) => { window.SCALE = sc }
Pattern.prototype.sc = function (mode) {
  let scale = reify(window.SCALE)
  if (mode != null) {
    mode = reify(mode)
    scale = scale.innerBind(([root]) => mode.withValue(m => [root, m]))
  }
  return this.scale(scale)
}
Pattern.prototype.nsc = function (pat = 0, oct = 3) {
  pat = reify(pat)
  return this.set.out(pat.as("n").sc()).octave(oct)
}

// --- chord shapes + chrd (degree:variation)
window.chordshapes = [
  "0,4", "0,2,4", "-7,0,2,4,7", "-7,0,2,3,7", "0,2,4,6", "0,2,3,6", "0,4,7,9",
  "0,4,7,8", "0,4,6,9", "0,2,6,9", "0,2,6,10", "0,2,4,6,8", "-7,0,2,6,9",
  "0,4,7,9,13", "0,4,8,9,13", "0,2,7,8,11", "0,2,8,9,11", "-7,0,2,3,7",
  "0,3,4", "0,1,4", "0,2,3,4", "0,2,4,8", "0,2,4,9", "0,4,6,8", "0,2,5,9",
  "0,4,7,11", "0,7,9,11", "0,2,7,11", "-7,0,4,7", "-7,0,4,6", "-7,0,2,9",
  "-7,0,4,9", "-7,0,2,4,9", "-7,0,2,4,6,9", "-7,0,2,4,8", "-7,0,3,7,10",
  "0,1,4,7", "0,1,3,7", "0,4,5,7", "0,5,7", "0,5,7,10", "0,5,10", "-7,0,5,7",
  "-7,0,1,5", "-7,-3,0,5", "0,1,5,8", "0,3,5,8", "0,2,4,7", "0,4,7,11,14",
  "-7,0,2,4,7,11", "0,2,4,6,9,11", "0,7,11,14", "0,2,9,11,14", "-12,0,4,7,11",
  "-12,-7,0,4,7"
]
window.chrd = function (c) {
  c = reify(c)
  return c.outerBind(c => {
    const [degree, variation = 0] = [c].flat()
    const chords = window.chordshapes[Math.min(variation, window.chordshapes.length - 1)]
    return n(chords).add(n(degree))
  })
}

// --- comb filter FX (short feedback delays). Guarded: if the DSP graph API
// (FX/K/S/audioin) is unavailable, fall back to identity so stems still play.
register('comb', (inp, pat) => {
  if (typeof audioin === 'undefined' || typeof pat.FX !== 'function') return pat
  let [delay, feedback = .6] = [inp].flat()
  delay = reify(delay).div(100)
  return pat.FX(K(() => {
    const d = S(delay)
    const q = S(feedback)
    return audioin()
      .add(x => x.delay(d).mul(q))
      .add(x => x.delay(2 * d).mul(q * q))
      .add(x => x.delay(3 * d).mul(q * q * q))
      .add(x => x.delay(4 * d).mul(q * q * q * q))
      .out()
  })).fxr(1)
})

// --- delay helper: more delay => more feedback
register('dly', (amt, x) => {
  amt = reify(amt)
  return x.delay(amt.mul(.8)).delayfeedback(amt.pow(2)).mask(amt.floor().inv())
})

// --- fill gaps between events (support for tgate)
register('fill', function (pat) {
  return new Pattern(function (state) {
    const lookbothways = 1
    const haps = pat.query(state.withSpan(span =>
      new TimeSpan(span.begin.sub(lookbothways), span.end.add(lookbothways))))
    const onsets = haps.map(hap => hap.whole.begin)
      .sort((a, b) => a.compare(b))
      .filter((x, i, arr) => i == (arr.length - 1) || x.ne(arr[i + 1]))
    const newHaps = []
    for (const hap of haps) {
      if (hap.part.begin.gte(state.span.end)) continue
      const next = onsets.find(onset => onset.gte(hap.whole.end))
      if (next === undefined) continue
      if (next.lte(state.span.begin)) continue
      const whole = new TimeSpan(hap.whole.begin, next)
      const part = new TimeSpan(hap.part.begin.max(state.span.begin), next.min(state.span.end))
      newHaps.push(new Hap(whole, part, hap.value, hap.context, hap.stateful))
    }
    return newHaps
  })
})

// --- trance gate
register('tgate', (amt, cycle, length, pat) => {
  amt = reify(amt)
  cycle = reify(cycle)
  return pat.struct(pure("x").fast(16)
    .degradeBy(amt.mul(-1).add(1))
    .ribbon(cycle, length)).fill().clip(.7)
})

// --- tracker-style arrangement (kept for future section automation)
window.track = function (...input) {
  const patterns = input.shift()
  let mods = Array.isArray(input.at(-1)) ? input.pop() : undefined
  if (input.length % 2 !== 0) {
    throw new Error('track needs a length for each pattern (length, pattern, ...)')
  }
  let sects = []
  let total = 0
  for (let i = 0; i < input.length; i += 2) {
    let inp = [input.at(i)].flat()
    let cycles = inp.at(0)
    let start = inp.at(1) ?? 0
    total += cycles
    let cpat = input.at(i + 1).innerBind((str) => {
      const pats = []
      str.split(/-+/).forEach((val, index) => {
        if (val == false) return
        let newPat = patterns.at(index)
        mods?.forEach(([mod, callback]) => { if (val == mod) newPat = callback(newPat) })
        pats.push(newPat)
      })
      return stack(...pats)
    })
    sects.push([cycles, cpat.ribbon(start, cycles).fast(cycles)])
  }
  return stepcat(...sects).slow(total)
}
window.p = stack

// --- humanize: nudge timing + velocity
register('humanize', (amt, pat) => {
  const amtC = Math.max(0, Math.min(1, amt))
  return pat.withHaps((haps) => haps.map((hap) => {
    const offset = 0.1 * amtC * (2 * Math.random() - 1)
    return hap.withSpan((span) => span.withTime(t => t + offset))
  })).withValue((v) => ({ ...v, velocity: (v.velocity ?? 1) + 0.5 * amtC * (2 * Math.random() - 1) }))
})

// === Additional helpers ported from brebake.strudel ==========================
// These only DEFINE functions/transforms — none execute at eval time, so an
// unavailable superdough control (warp/diode/bstab/...) can only fail when the
// helper is actually called, never breaks prelude evaluation.

// The REPL editor's reactive slider() isn't available headlessly — shim it to
// return its default (first) argument so authored stems can keep slider(x, ...).
window.slider = (val = 0.5) => val

// --- grab: quantize each note to the nearest of a given set, e.g. grab("c:eb:g")
register('grab', function (scale, pat) {
  scale = (Array.isArray(scale) ? scale.flat() : [scale]).flatMap((val) =>
    typeof val === 'number' ? val : noteToMidi(val) - 48)
  return pat.withHap((hap) => {
    const isObject = typeof hap.value === 'object'
    let note = isObject ? hap.value.n : hap.value
    if (typeof note === 'string') note = noteToMidi(note)
    if (isObject) delete hap.value.n
    const transpose = ((note / 12) >> 0) * 12
    const goal = note - transpose
    note = scale.reduce((prev, curr) =>
      Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev) + transpose
    return hap.withValue(() => (isObject ? { ...hap.value, note } : note))
  })
})

// --- acid: supersaw acid voice
register('acid', (pat) => pat.s('supersaw').detune(.5).unison(1)
  .lpf(100).lpsustain(0.2).lpd(.2).lpenv(2).lpq(12))

// --- notearp: arpeggiate chord tones by index
register('notearp', (indices, pat) => pat.arpWith((haps) =>
  reify(indices).fmap((i) => {
    const transpose = Math.trunc(i / haps.length) * 12
    const hap = haps[i % haps.length]
    return hap.withValue(v => ({ ...v, note: noteToMidi(v.note ?? 'C3') + transpose }))
  })), false)

// --- fmtime: FM index driven by transport time
register('fmtime', (start, length, pat) => {
  const modu = time.mod(length).add(start)
  return pat.fm(modu).fmh(modu)
})

// --- trancegate (older rand-based variant; .tgate above is the better one)
register('trancegate', (density, seed, length, x) => {
  density = reify(density).add(.5)
  return x.struct(rand.mul(density).round().seg(16).ribbon(seed, length)).fill().clip(.7)
})

// --- rlpf / rhpf: cutoff driven on a 0..1 curve
register('rlpf', (x, pat) => pat.lpf(pure(x).mul(12).pow(4)))
register('rhpf', (x, pat) => pat.hpf(pure(x).mul(12).pow(4)))

// --- swap: replace one value with another
register('swap', (find, rep, x) => x.withValue(v => (v === find ? rep : v)))

// --- sb: sometimesBy shorthand
register('sb', (p, cb, pat) => pat.sometimesBy(p, cb))

// --- ifit: fit a sample inside N cycles
register('ifit', (cycles, pat) => pat.inside(cycles, fit).slow(cycles).clip(1))

// --- vstruct: velocity structure
register('vstruct', (ipat, pat) =>
  ipat.outerBind(vel => pat.keepif.out(Math.ceil(vel)).velocity(vel)), false)

// --- sf: oldschool timestretch
Pattern.prototype.sf = function (cycles, segments = 16) {
  cycles = reify(cycles)
  return this.scrub(saw.seg(cycles.mul(segments))).slow(cycles).sustain(1)
}

// --- over / overin: layer extra voices through a sound
Pattern.prototype.over = function (...inp) { return this.set.out(stack(...inp)) }
Pattern.prototype.overin = function (...inp) { return this.set.in(stack(...inp)) }

// --- small utilities
window.randm = (division) => irand(division).div(16)
window.irando = (ipat) => reify(ipat).fmap(_irand).outerJoin()
window.pk = function (...args) {
  const control = args.length > 2 ? args.pop() : 0
  return pick(args, control)
}
window.ar = function (...input) {
  if (input.length % 2 !== 0) throw new Error('ar needs a length for each pattern')
  const sects = []
  let total = 0
  for (let i = 0; i < input.length; i += 2) {
    const inp = [input.at(i)].flat()
    const cycles = inp.at(0)
    const start = inp.at(1) ?? 0
    total += cycles
    sects.push([cycles, input.at(i + 1).ribbon(start, cycles).fast(cycles)])
  }
  return stepcat(...sects).slow(total)
}

// --- wavetable voices (previously excluded). Wavetable/warp/diode controls
// resolve in superdough at play time; the samples come from Dough-Waveforms.
window.roller = (wt = 0) => s("wt_digital")
  .wt(wt).wtenv(0).wtdecay(.2).warp(0).warpmode(7).warpenv(.5).warpdec(.1)
  .dec(.2).lpq(0).dly(.8).room(.7).roomsize(4).diode("1").acidenv(.44)

window.roller2 = (acidenv = .5) => s("bstab:1:.6,supersaw:1:.6,white:0:.3").detune(rand)
  .begin("<0 .02>/4").room(.5).acidenv(acidenv).lpq(0).postgain(1.2).diode([2.5, .6])
  .sustain(.45).dec(.2)

window.spinor = (alive = 1, dead = 0) => s("wt_digital").lfo({ dr: 0.05 })
  .wtrate(alive).unison(3).detune(alive).compressor(-20)
  .fm(dead).fmh(4)
  .FX(lpf(200).lpe(4).lpa(0.5).lps(1).K(() => {
    audioin().sub(x => x.bpf(sine(0.13).mul(S(rand)))).out()
  }).asym(reify(0.3).mul(dead)), diode(0.7), gain(0.3)).fxr(1)

silence
`

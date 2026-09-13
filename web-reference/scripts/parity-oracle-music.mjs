// Oracle for the Godot music port: runs the web rng / MusicDirector / MenuMusic sources directly (Node strips the
// TypeScript types; a resolve hook adds the .ts extension and stubs the Vite-only stem glob) and records their
// deterministic outputs — seed hashes, a PRNG stream, the stem library order and per-loop arrangements.
//   node scripts/parity-oracle-music.mjs [output json]      (Node >= 23.5: type stripping + module.registerHooks)
import { registerHooks } from 'node:module';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const STEMS_STUB = 'data:text/javascript,export const STEM_LIBRARY = { bass: [], kicks: [], lead: [], sfx: [] };';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/stems')) return { url: STEMS_STUB, shortCircuit: true };
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { hashSeed, mulberry32 } = await import('../src/game/audio/rng.ts');
const { MusicDirector } = await import('../src/game/audio/MusicDirector.ts');
const { MenuMusic } = await import('../src/game/audio/MenuMusic.ts');

const output = resolve(process.argv[2] ?? '../tests/fixtures/music_oracle.json');
const ROLES = ['bass', 'kicks', 'lead', 'sfx'];
const SEEDS = ['K7Q2X', 'ABCD', 'room-42', 'Ñandú', ''];
const COMPOSED_SEEDS = 2;
const LOOPS = 60;
const OUTRO_LOOP = 30;
const OUTRO_REMAINING_MS = 12000;
const PRNG_SEED = 12345;
const PRNG_VALUES = 8;
const MENU_RNG_SEED = 99;
const MENU_LOOPS = 40;

const range = n => Array.from({ length: n }, (_, i) => i);
const library = {};
for (const role of ROLES) {
  const names = (await readdir(new URL(`../src/assets/music/${role}`, import.meta.url))).filter(n => n.endsWith('.opus'));
  // Same as stems.ts: id = role/name, sorted with localeCompare.
  library[role] = names.map(n => ({ id: `${role}/${n.slice(0, -'.opus'.length)}`, url: '' }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
const director = new MusicDirector();
const prng = mulberry32(PRNG_SEED);
const menu = new MenuMusic({}, mulberry32(MENU_RNG_SEED));
const fixture = {
  hashes: Object.fromEntries(SEEDS.map(code => [code, hashSeed(code)])),
  prng: { seed: PRNG_SEED, values: range(PRNG_VALUES).map(() => prng()) },
  library: Object.fromEntries(ROLES.map(role => [role, library[role].map(stem => stem.id)])),
  compose: SEEDS.slice(0, COMPOSED_SEEDS).map(code => ({
    code,
    loops: range(LOOPS).map(i => director.compose(hashSeed(code), i, library, Infinity)),
    outro: { loop: OUTRO_LOOP, remainingMs: OUTRO_REMAINING_MS,
      voices: director.compose(hashSeed(code), OUTRO_LOOP, library, OUTRO_REMAINING_MS) },
  })),
  menu: { rngSeed: MENU_RNG_SEED, loops: range(MENU_LOOPS).map(i => menu.arrange(i)) },
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(fixture, null, 1));
console.log(`ORACLE ${output}: ${Object.values(fixture.library).flat().length} stems, ${LOOPS} loops x ${COMPOSED_SEEDS} seeds`);

// The desktop build in a plain browser for parity captures: a stub __TAURI_INTERNALS__ answers the fs and path plugins
// from an in-memory app-data folder seeded with `library` ([path, contents | null for a folder]); every other invoke
// pends. Pass stubDesktop to page.addInitScript with { appData: APP_DATA, library }.
export const APP_DATA = 'C:\\Users\\PARITY7\\AppData\\Roaming\\com.oneshot.game';

export const stubDesktop = ({ appData, library }) => {
  const dirs = new Set(library.filter(([, c]) => c === null).map(([p]) => p));
  const files = new Map(library.filter(([, c]) => c !== null));
  const pending = () => new Promise(() => {});
  const handlers = {
    'plugin:path|resolve_directory': () => appData,
    'plugin:path|join': (args) => args.paths.join('\\'),
    'plugin:fs|mkdir': (args) => { dirs.add(args.path); },
    'plugin:fs|exists': (args) => dirs.has(args.path) || files.has(args.path),
    'plugin:fs|read_dir': (args) => {
      const prefix = `${args.path}/`;
      const out = [];
      for (const d of dirs) if (d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) out.push({ name: d.slice(prefix.length), isDirectory: true, isFile: false, isSymlink: false });
      for (const f of files.keys()) if (f.startsWith(prefix) && !f.slice(prefix.length).includes('/')) out.push({ name: f.slice(prefix.length), isDirectory: false, isFile: true, isSymlink: false });
      return out;
    },
    'plugin:fs|read_text_file': (args) => Array.from(new TextEncoder().encode(files.get(args.path) ?? '')),
    'plugin:fs|write_text_file': (bytes, options) => { files.set(decodeURIComponent(options.headers.path), new TextDecoder().decode(bytes)); },
    'plugin:fs|remove': (args) => { files.delete(args.path); dirs.delete(args.path); },
    'plugin:fs|rename': (args) => { if (files.has(args.oldPath)) { files.set(args.newPath, files.get(args.oldPath)); files.delete(args.oldPath); } },
  };
  window.__TAURI_INTERNALS__ = {
    invoke: (cmd, args, options) => (handlers[cmd] ? Promise.resolve(handlers[cmd](args, options)) : pending()),
    transformCallback: () => 0, metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  };
};

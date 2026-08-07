# Quick Export

An Obsidian plugin that saves a copy of a note — or just the text you selected — to a folder outside the vault, as `.md` or `.txt`.

Desktop only: it uses Node's filesystem APIs, which are not available on iOS or Android.

## Right-click a note

In the file explorer, on a tab, or on the note title:

- **Export a copy as Markdown**
- **Export a copy as plain text**

The note does not have to be open. If it *is* open with unsaved edits, the export takes the live editor content rather than the older copy on disk.

Only markdown notes get these items; right-clicking an image or a PDF leaves the menu untouched.

## Right-click a selection

Select text inside a note, then right-click it:

- **Export selection as Markdown**
- **Export selection as plain text**

These items appear **only when something is selected**, so the editor's context menu stays clean during ordinary writing.

## Command palette and hotkeys

The same four operations are also registered as commands, visible only while an editor is active:

| Command | Writes |
|---|---|
| Export note as Markdown | whole note → `.md` |
| Export selection as Markdown | selection → `.md` |
| Export note as plain text | whole note → `.txt` |
| Export selection as plain text | selection → `.txt` |

Assign a hotkey under **Settings → Hotkeys**, filtering by "Quick Export". Four hotkeys for four variants is usually overkill — bind the one you actually use and reach the rest from the menus.

## File naming

Exports are named `<note name>-<timestamp>.<ext>`, for example `Meeting notes-2026-08-07_143045.md`.

Characters that are illegal in file names (`/ \ : * ? " < > |`) are replaced with `-`, and the note-name portion is capped at 80 characters. The timestamp uses **local time**, not UTC, so an evening export is not stamped with the previous day.

## Settings

| Setting | Default | Effect |
|---|---|---|
| Export folder | `~/Desktop` | Destination directory. A leading `~` expands to your home folder. |
| Timestamp format | Readable | `2026-08-07_143045` or `2026-08-07T14-30-45`. |
| Also copy to clipboard | Off | Mirrors the exported text to the clipboard. A clipboard failure never invalidates a successful write to disk. |

## Development

Requires Node 18 or newer.

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` watches `src/` and rebuilds `main.js` on save. To pick up changes in Obsidian without restarting it, install [Hot Reload](https://github.com/pjeby/hot-reload) into your development vault.

Production build — this one also runs `tsc -noEmit`, so type errors fail the build:

```bash
npm run build
```

Lint, including the Obsidian-specific guideline rules:

```bash
npm run lint
```

### Testing against a vault

Symlink the repo into a development vault rather than copying it:

```bash
ln -s ~/Desktop/Plugins/quick-export ~/obsidian-dev-vault/.obsidian/plugins/quick-export
```

Do not develop against a vault you care about — a half-finished export plugin has write access to real files.

## Installing into a real vault

Copy the three build artifacts (not the whole repo) into `<vault>/.obsidian/plugins/quick-export/`:

```bash
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/quick-export/
```

Then **Settings → Community plugins → Reload plugins**, and enable Quick Export.

## Layout

```
src/main.ts        plugin entry, commands, file-menu and editor-menu wiring
src/exporter.ts    text extraction, file naming, disk write, clipboard
src/settings.ts    settings interface, defaults, settings tab
```

`exporter.ts` exposes two entry points over a shared write path: `exportText`
for anything driven by an open editor, and `exportFile` for the context-menu
case where a note may not be open at all.

## What it touches

The plugin reads; it never modifies the vault. There are no calls to
`vault.modify`, `vault.delete`, `vault.trash`, `vault.rename` or
`vault.create`, and no `replaceSelection` / `replaceRange` on the editor.

The only filesystem operation is a single `fs.writeFile` into the configured
export folder. The plugin does not create that folder — a path that does not
exist produces an error notice rather than a surprise directory.

## License

MIT

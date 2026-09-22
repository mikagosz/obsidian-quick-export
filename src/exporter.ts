import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { remote } from 'electron';
import { type App, type Editor, MarkdownView, Notice, type TFile } from 'obsidian';

export type ExportFormat = 'md' | 'txt';
export type TimestampFormat = 'iso' | 'readable';

/** Everything needed to put text on disk. */
export interface WriteOptions {
	format: ExportFormat;
	copyToClipboard: boolean;
	targetDir: string;
	timestampFormat: TimestampFormat;
	askLocation: boolean;
}

/** Adds the editor-specific choice of whole note vs. selection. */
export interface ExportOptions extends WriteOptions {
	selectionOnly: boolean;
}

/** The export folder a fresh install starts with, and the one an emptied field falls back to. */
export const DEFAULT_EXPORT_PATH = '~/Desktop';

/**
 * Expands a leading `~` to the user's home directory. Obsidian's own
 * `normalizePath` is for vault-relative paths, so it must not be used here.
 *
 * An emptied field means the default, not "here": an empty string joined with a
 * file name is a relative path, which Node resolves against Obsidian's working
 * directory — `/` on macOS, where the write fails with EROFS and a message that
 * says nothing about the setting.
 */
export function resolveDir(raw: string): string {
	const trimmed = raw.trim() || DEFAULT_EXPORT_PATH;
	if (trimmed === '~') return homedir();
	if (trimmed.startsWith('~/')) return join(homedir(), trimmed.slice(2));
	return trimmed;
}

function describeError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/**
 * Every export is started from a click, so nothing on this path may end in
 * silence. Without this the promise is dropped with `void` and an unexpected
 * throw becomes an unhandled rejection: the menu item does nothing, and the user
 * has no way of knowing why.
 */
export function report(work: Promise<unknown>): void {
	void work.catch((err: unknown) => {
		console.error('[quick-export] export failed', err);
		new Notice(`Export failed: ${describeError(err)}`);
	});
}

/** Strips characters that are illegal in file names and caps the length. */
export function sanitizeName(name: string): string {
	const cleaned = name
		.replace(/[/\\:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80);
	return cleaned.length > 0 ? cleaned : 'untitled';
}

/**
 * Local time on purpose: toISOString() returns UTC, which stamps the previous
 * day onto anything exported late in the evening.
 */
function timestamp(format: TimestampFormat): string {
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, '0');
	const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
	const h = p(d.getHours());
	const m = p(d.getMinutes());
	const s = p(d.getSeconds());
	return format === 'iso' ? `${date}T${h}-${m}-${s}` : `${date}_${h}${m}${s}`;
}

export function buildFileName(
	file: TFile | null,
	options: Pick<WriteOptions, 'format' | 'timestampFormat'>,
): string {
	const base = sanitizeName(file?.basename ?? 'untitled');
	return `${base}-${timestamp(options.timestampFormat)}.${options.format}`;
}

/**
 * With `askLocation` on, opens a native save dialog seeded with the
 * configured export folder and suggested name — the user can redirect the
 * save anywhere. A cancelled dialog returns null; it never falls back to
 * writing silently, since that would defeat the point of asking.
 */
async function resolveTargetPath(fileName: string, options: WriteOptions): Promise<string | null> {
	// A relative folder would be resolved against Obsidian's working directory,
	// which the user never chose and cannot see: on macOS the write fails with a
	// bare EROFS, elsewhere it can succeed somewhere nobody will look. The dialog
	// can still start from the file name alone; a direct write refuses instead.
	const absolute = isAbsolute(options.targetDir);
	const direct = (): string => {
		if (!absolute) {
			throw new Error(
				`the export folder "${options.targetDir}" is not a full path. In the Quick Export settings, set it to a folder starting with / or ~`,
			);
		}
		return join(options.targetDir, fileName);
	};

	if (!options.askLocation) {
		return direct();
	}

	// Electron dropped `remote` in version 14; Obsidian re-attaches it to the
	// module for compatibility, which is the only reason this works at all. If
	// that ever stops, write to the configured folder and say so — the one thing
	// a click must never do is nothing.
	const dialog = remote?.dialog;
	if (!dialog) {
		new Notice('This Obsidian build has no save dialog — saving to the export folder instead');
		return direct();
	}

	const result = await dialog.showSaveDialog({
		defaultPath: absolute ? join(options.targetDir, fileName) : fileName,
		filters: [
			{
				name: options.format === 'md' ? 'Markdown' : 'Text',
				extensions: [options.format],
			},
		],
	});

	return result.canceled || !result.filePath ? null : result.filePath;
}

/**
 * Shared tail of every export: name the file, write it, optionally mirror it
 * to the clipboard. Callers are responsible for rejecting empty input, since
 * only they know whether "empty" means an empty note or an empty selection.
 */
async function writeExport(
	text: string,
	file: TFile | null,
	options: WriteOptions,
): Promise<string | null> {
	const fileName = buildFileName(file, options);
	const fullPath = await resolveTargetPath(fileName, options);

	if (fullPath === null) {
		new Notice('Export cancelled');
		return null;
	}

	try {
		// The write lands outside the vault, where a name collision means somebody
		// else's file. With the save dialog the user confirmed the path themselves,
		// so overwriting is their decision; without it, refuse and say so rather
		// than clobber. `wx` fails when the file already exists.
		await fs.writeFile(fullPath, text, {
			encoding: 'utf-8',
			flag: options.askLocation ? 'w' : 'wx',
		});
	} catch (err) {
		if (err instanceof Error && 'code' in err && err.code === 'EEXIST') {
			new Notice(`${fileName} already exists in the export folder — nothing was overwritten`);
			return null;
		}
		console.error('[quick-export] write failed', err);
		new Notice(`Export failed: ${describeError(err)}`);
		return null;
	}

	// Kept separate: a clipboard failure must not invalidate a successful write.
	if (options.copyToClipboard) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('[quick-export] clipboard failed', err);
			new Notice(`Saved ${fileName}, but clipboard copy failed`);
			return fullPath;
		}
	}

	// The folder too: with the save dialog off, the name alone does not say where
	// the file went.
	new Notice(`Saved ${fileName} to ${dirname(fullPath)}`);
	return fullPath;
}

/**
 * Export driven by an open editor: the whole note, or just the selection.
 */
export async function exportText(
	editor: Editor,
	file: TFile | null,
	options: ExportOptions,
): Promise<string | null> {
	const text = options.selectionOnly ? editor.getSelection() : editor.getValue();

	if (text.trim().length === 0) {
		new Notice(options.selectionOnly ? 'Nothing selected' : 'Note is empty');
		return null;
	}

	return writeExport(text, file, options);
}

/**
 * If the file is open in a markdown editor, returns the live editor content.
 * Reading the vault instead would miss edits Obsidian has not flushed to disk
 * yet, so a right-click export could silently save a stale copy.
 */
function readOpenEditor(app: App, file: TFile): string | null {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		const view = leaf.view;
		if (view instanceof MarkdownView && view.file === file) {
			return view.editor.getValue();
		}
	}
	return null;
}

/**
 * Export driven by a file, with no editor involved — the file-explorer and
 * tab context menus reach notes that may not be open at all.
 */
export async function exportFile(
	app: App,
	file: TFile,
	options: WriteOptions,
): Promise<string | null> {
	let text = readOpenEditor(app, file);

	if (text === null) {
		try {
			text = await app.vault.read(file);
		} catch (err) {
			console.error('[quick-export] read failed', err);
			new Notice(`Export failed: ${describeError(err)}`);
			return null;
		}
	}

	if (text.trim().length === 0) {
		new Notice('Note is empty');
		return null;
	}

	return writeExport(text, file, options);
}

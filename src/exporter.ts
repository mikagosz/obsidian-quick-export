import { App, Editor, MarkdownView, Notice, TFile } from 'obsidian';
import { remote } from 'electron';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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

/**
 * Expands a leading `~` to the user's home directory. Obsidian's own
 * `normalizePath` is for vault-relative paths, so it must not be used here.
 */
export function resolveDir(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed === '~') return homedir();
	if (trimmed.startsWith('~/')) return join(homedir(), trimmed.slice(2));
	return trimmed;
}

function describeError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Strips characters that are illegal in file names and caps the length. */
function sanitizeName(name: string): string {
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
async function resolveTargetPath(
	fileName: string,
	options: WriteOptions,
): Promise<string | null> {
	if (!options.askLocation) {
		return join(options.targetDir, fileName);
	}

	const result = await remote.dialog.showSaveDialog({
		defaultPath: join(options.targetDir, fileName),
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
		await fs.writeFile(fullPath, text, 'utf-8');
	} catch (err) {
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

	new Notice(`Saved ${fileName}`);
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
	const text = options.selectionOnly
		? editor.getSelection()
		: editor.getValue();

	if (text.trim().length === 0) {
		new Notice(
			options.selectionOnly ? 'Nothing selected' : 'Note is empty',
		);
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

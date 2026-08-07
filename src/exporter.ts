import { Editor, Notice, TFile } from 'obsidian';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type ExportFormat = 'md' | 'txt';
export type TimestampFormat = 'iso' | 'readable';

export interface ExportOptions {
	format: ExportFormat;
	selectionOnly: boolean;
	copyToClipboard: boolean;
	targetDir: string;
	timestampFormat: TimestampFormat;
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
	options: Pick<ExportOptions, 'format' | 'timestampFormat'>,
): string {
	const base = sanitizeName(file?.basename ?? 'untitled');
	return `${base}-${timestamp(options.timestampFormat)}.${options.format}`;
}

/**
 * Writes the active note (or its selection) to disk and optionally mirrors it
 * to the clipboard. Returns the written path, or null if nothing was written.
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

	const fileName = buildFileName(file, options);
	const fullPath = join(options.targetDir, fileName);

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

import { Editor, MarkdownFileInfo, MarkdownView, Plugin } from 'obsidian';
import { exportText, resolveDir, type ExportFormat } from './exporter';
import {
	DEFAULT_SETTINGS,
	QuickExportSettingTab,
	type QuickExportSettings,
} from './settings';

interface Variant {
	id: string;
	name: string;
	format: ExportFormat;
	selectionOnly: boolean;
}

const VARIANTS: Variant[] = [
	{
		id: 'export-note-md',
		name: 'Export note as Markdown',
		format: 'md',
		selectionOnly: false,
	},
	{
		id: 'export-selection-md',
		name: 'Export selection as Markdown',
		format: 'md',
		selectionOnly: true,
	},
	{
		id: 'export-note-txt',
		name: 'Export note as plain text',
		format: 'txt',
		selectionOnly: false,
	},
	{
		id: 'export-selection-txt',
		name: 'Export selection as plain text',
		format: 'txt',
		selectionOnly: true,
	},
];

export default class QuickExportPlugin extends Plugin {
	settings!: QuickExportSettings;

	async onload() {
		await this.loadSettings();

		for (const variant of VARIANTS) {
			this.addCommand({
				id: variant.id,
				name: variant.name,
				// editorCallback keeps the command out of the palette whenever
				// there is no active editor, so no manual view check is needed.
				editorCallback: (
					editor: Editor,
					ctx: MarkdownView | MarkdownFileInfo,
				) => {
					void exportText(editor, ctx.file, {
						format: variant.format,
						selectionOnly: variant.selectionOnly,
						copyToClipboard: this.settings.autoClipboard,
						targetDir: resolveDir(this.settings.exportPath),
						timestampFormat: this.settings.timestampFormat,
					});
				},
			});
		}

		this.addSettingTab(new QuickExportSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<QuickExportSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

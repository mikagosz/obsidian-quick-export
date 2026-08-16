import {
	type Editor,
	type MarkdownFileInfo,
	type MarkdownView,
	type Menu,
	Plugin,
	type TAbstractFile,
	TFile,
} from 'obsidian';
import {
	type ExportFormat,
	exportFile,
	exportText,
	report,
	resolveDir,
	type WriteOptions,
} from './exporter';
import { DEFAULT_SETTINGS, type QuickExportSettings, QuickExportSettingTab } from './settings';

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
				editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
					report(
						exportText(editor, ctx.file, {
							...this.writeOptions(variant.format),
							selectionOnly: variant.selectionOnly,
						}),
					);
				},
			});
		}

		this.registerFileMenu();
		this.registerEditorMenu();

		this.addSettingTab(new QuickExportSettingTab(this.app, this));
	}

	/** Right-click a note in the file explorer, its tab, or the title bar. */
	private registerFileMenu() {
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				if (!(file instanceof TFile)) return;
				if (file.extension !== 'md') return;

				menu.addItem((item) =>
					item
						.setTitle('Export a copy as Markdown')
						.setIcon('download')
						.onClick(() => {
							report(exportFile(this.app, file, this.writeOptions('md')));
						}),
				);
				menu.addItem((item) =>
					item
						.setTitle('Export a copy as plain text')
						.setIcon('download')
						.onClick(() => {
							report(exportFile(this.app, file, this.writeOptions('txt')));
						}),
				);
			}),
		);
	}

	/**
	 * Right-click inside the editor. The items only appear when text is
	 * actually selected, so the menu stays clean during ordinary editing.
	 */
	private registerEditorMenu() {
		this.registerEvent(
			this.app.workspace.on(
				'editor-menu',
				(menu: Menu, editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
					if (editor.getSelection().trim().length === 0) return;

					menu.addItem((item) =>
						item
							.setTitle('Export selection as Markdown')
							.setIcon('download')
							.onClick(() => {
								report(
									exportText(editor, ctx.file, {
										...this.writeOptions('md'),
										selectionOnly: true,
									}),
								);
							}),
					);
					menu.addItem((item) =>
						item
							.setTitle('Export selection as plain text')
							.setIcon('download')
							.onClick(() => {
								report(
									exportText(editor, ctx.file, {
										...this.writeOptions('txt'),
										selectionOnly: true,
									}),
								);
							}),
					);
				},
			),
		);
	}

	/** Settings are read at click time, so changes take effect immediately. */
	private writeOptions(format: ExportFormat): WriteOptions {
		return {
			format,
			copyToClipboard: this.settings.autoClipboard,
			targetDir: resolveDir(this.settings.exportPath),
			timestampFormat: this.settings.timestampFormat,
			askLocation: this.settings.askLocation,
		};
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

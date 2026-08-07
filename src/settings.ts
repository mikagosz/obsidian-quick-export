import { App, PluginSettingTab, Setting } from 'obsidian';
import type QuickExportPlugin from './main';
import type { TimestampFormat } from './exporter';

export interface QuickExportSettings {
	autoClipboard: boolean;
	exportPath: string;
	timestampFormat: TimestampFormat;
	askLocation: boolean;
}

export const DEFAULT_SETTINGS: QuickExportSettings = {
	autoClipboard: false,
	exportPath: '~/Desktop',
	timestampFormat: 'readable',
	askLocation: true,
};

export class QuickExportSettingTab extends PluginSettingTab {
	plugin: QuickExportPlugin;

	constructor(app: App, plugin: QuickExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Ask where to save')
			.setDesc(
				'Show a native save dialog on every export instead of writing straight to the export folder below.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.askLocation)
					.onChange(async (value) => {
						this.plugin.settings.askLocation = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Export folder')
			.setDesc(
				'Where exported files are written. A leading "~" is your home folder. Also the folder the save dialog opens to, when "Ask where to save" is on.',
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.exportPath)
					.onChange(async (value) => {
						this.plugin.settings.exportPath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Timestamp format')
			.setDesc('Appended to the note name to keep exports unique.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('readable', 'Compact (2026-08-07_143045)')
					.addOption('iso', 'Expanded (2026-08-07T14-30-45)')
					.setValue(this.plugin.settings.timestampFormat)
					.onChange(async (value) => {
						this.plugin.settings.timestampFormat =
							value as TimestampFormat;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Also copy to clipboard')
			.setDesc('Copy the exported text as well as writing it to disk.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoClipboard)
					.onChange(async (value) => {
						this.plugin.settings.autoClipboard = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

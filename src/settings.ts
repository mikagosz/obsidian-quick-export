import {
	App,
	PluginSettingTab,
	Setting,
	type SettingDefinitionBase,
	type SettingDefinitionItem,
	type SettingDropdownControl,
	type SettingTextControl,
	type SettingToggleControl,
} from 'obsidian';
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

type SettingKey = keyof QuickExportSettings;

/** Only the three control kinds this plugin actually uses. */
type QuickExportControl =
	| SettingToggleControl<SettingKey>
	| SettingTextControl<SettingKey>
	| SettingDropdownControl<SettingKey>;

interface QuickExportDefinition extends SettingDefinitionBase {
	control: QuickExportControl;
}

export class QuickExportSettingTab extends PluginSettingTab {
	plugin: QuickExportPlugin;

	constructor(app: App, plugin: QuickExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * The single source of truth for this tab. Obsidian 1.13.0+ renders these
	 * definitions itself and indexes them for the settings search; older
	 * versions never call `getSettingDefinitions`, so `display` below walks the
	 * same list. Keeping one list means the two paths cannot drift apart.
	 */
	private definitions(): QuickExportDefinition[] {
		return [
			{
				name: 'Ask where to save',
				desc: 'Show a native save dialog on every export instead of writing straight to the export folder below.',
				aliases: ['save dialog', 'prompt', 'destination'],
				control: {
					type: 'toggle',
					key: 'askLocation',
					defaultValue: DEFAULT_SETTINGS.askLocation,
				},
			},
			{
				name: 'Export folder',
				desc: 'Where exported files are written. A leading "~" means your home folder. The save dialog opens here too.',
				aliases: ['output', 'path', 'folder'],
				control: {
					type: 'text',
					key: 'exportPath',
					placeholder: DEFAULT_SETTINGS.exportPath,
					defaultValue: DEFAULT_SETTINGS.exportPath,
				},
			},
			{
				name: 'Timestamp format',
				desc: 'Appended to the note name to keep exports unique.',
				aliases: ['date', 'suffix', 'file name'],
				control: {
					type: 'dropdown',
					key: 'timestampFormat',
					options: {
						readable: 'Compact (2026-08-07_143045)',
						iso: 'Expanded (2026-08-07T14-30-45)',
					},
					defaultValue: DEFAULT_SETTINGS.timestampFormat,
				},
			},
			{
				name: 'Also copy to clipboard',
				desc: 'Copy the exported text as well as writing it to disk.',
				aliases: ['clipboard', 'copy'],
				control: {
					type: 'toggle',
					key: 'autoClipboard',
					defaultValue: DEFAULT_SETTINGS.autoClipboard,
				},
			},
		];
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.definitions();
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as SettingKey];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
	}

	/**
	 * Fallback for Obsidian older than 1.13.0, which renders setting tabs
	 * imperatively. Deliberately reads from the same `definitions()` list.
	 */
	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		for (const definition of this.definitions()) {
			const setting = new Setting(containerEl).setName(definition.name);
			if (typeof definition.desc === 'string') {
				setting.setDesc(definition.desc);
			}

			const control = definition.control;
			const commit = (value: unknown) => {
				void this.setControlValue(control.key, value);
			};

			switch (control.type) {
				case 'toggle':
					setting.addToggle((toggle) =>
						toggle
							.setValue(
								this.getControlValue(control.key) as boolean,
							)
							.onChange(commit),
					);
					break;
				case 'text':
					setting.addText((text) =>
						text
							.setPlaceholder(control.placeholder ?? '')
							.setValue(this.getControlValue(control.key) as string)
							.onChange(commit),
					);
					break;
				case 'dropdown':
					setting.addDropdown((dropdown) => {
						for (const [value, label] of Object.entries(
							control.options,
						)) {
							dropdown.addOption(value, label);
						}
						dropdown
							.setValue(
								this.getControlValue(control.key) as string,
							)
							.onChange(commit);
					});
					break;
			}
		}
	}
}

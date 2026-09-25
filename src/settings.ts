import {
	type App,
	debounce,
	PluginSettingTab,
	Setting,
	type SettingDefinitionBase,
	type SettingDefinitionItem,
	type SettingDropdownControl,
	type SettingTextControl,
	type SettingToggleControl,
} from 'obsidian';
import { DEFAULT_EXPORT_PATH, type TimestampFormat } from './exporter';
import type QuickExportPlugin from './main';

export interface QuickExportSettings {
	autoClipboard: boolean;
	exportPath: string;
	timestampFormat: TimestampFormat;
	askLocation: boolean;
}

export const DEFAULT_SETTINGS: QuickExportSettings = {
	autoClipboard: false,
	exportPath: DEFAULT_EXPORT_PATH,
	timestampFormat: 'readable',
	askLocation: true,
};

type SettingKey = keyof QuickExportSettings;

/**
 * Keys edited in a text field. Those report every keystroke, so their writes to
 * data.json wait for the typing to stop; toggles and dropdowns change once per
 * click and are saved at once.
 */
const TYPED_KEYS: ReadonlySet<string> = new Set<SettingKey>(['exportPath']);

/** How long typing has to pause before a typed value is written to disk. */
const TYPING_PAUSE_MS = 500;

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
	private typedPending = false;
	private readonly saveTyped = debounce(() => this.flushTyped(), TYPING_PAUSE_MS, true);

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

	/**
	 * Both render paths end here. Obsidian 1.13+ draws the tab from
	 * `getSettingDefinitions()` and calls this on every keystroke with no delay
	 * of its own, so a wait placed only in `display()` never ran there: typing a
	 * folder path wrote data.json once per character. The wait lives here now.
	 * The value in memory changes at once — exports read it at click time.
	 */
	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		if (TYPED_KEYS.has(key)) {
			this.typedPending = true;
			this.saveTyped();
			return;
		}
		await this.plugin.saveSettings();
	}

	/** Leaving the tab writes a pending typed value now rather than half a second later. */
	override hide(): void {
		this.saveTyped.cancel();
		this.flushTyped();
		super.hide();
	}

	private flushTyped(): void {
		if (!this.typedPending) return;
		this.typedPending = false;
		this.plugin.saveSettings().catch((error: unknown) => {
			console.error('[quick-export] could not save the settings', error);
		});
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
			// Typed values wait for the typing to stop inside `setControlValue`,
			// the same way on both render paths.
			const commit = (value: unknown) => {
				void this.setControlValue(control.key, value);
			};

			switch (control.type) {
				case 'toggle':
					setting.addToggle((toggle) =>
						toggle.setValue(this.getControlValue(control.key) as boolean).onChange(commit),
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
						for (const [value, label] of Object.entries(control.options)) {
							dropdown.addOption(value, label);
						}
						dropdown.setValue(this.getControlValue(control.key) as string).onChange(commit);
					});
					break;
			}
		}
	}
}

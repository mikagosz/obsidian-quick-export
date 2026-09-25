/**
 * When a settings change reaches data.json.
 *
 * Obsidian 1.13+ renders the tab from `getSettingDefinitions()` and calls
 * `setControlValue` on every keystroke, so a delay kept only in `display()`
 * never ran: typing a folder path wrote the file once per character. These pin
 * the write to the place both render paths share.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type QuickExportPlugin from '../src/main.ts';
import {
	DEFAULT_SETTINGS,
	type QuickExportSettings,
	QuickExportSettingTab,
} from '../src/settings.ts';

function setUp() {
	const saved: QuickExportSettings[] = [];
	const plugin = {
		settings: { ...DEFAULT_SETTINGS },
		saveSettings: async () => {
			saved.push({ ...plugin.settings });
		},
	};
	const tab = new QuickExportSettingTab({} as never, plugin as unknown as QuickExportPlugin);
	return { plugin, saved, tab };
}

describe('typing into the export folder field', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('writes once, after the typing stops, not once per character', async () => {
		const { plugin, saved, tab } = setUp();
		for (const typed of ['~', '~/', '~/D', '~/Do', '~/Doc']) {
			await tab.setControlValue('exportPath', typed);
			vi.advanceTimersByTime(100);
		}
		expect(saved).toHaveLength(0);
		// The value in memory is current at once, so an export started mid-typing
		// already goes to the new folder.
		expect(plugin.settings.exportPath).toBe('~/Doc');

		vi.advanceTimersByTime(500);
		expect(saved).toHaveLength(1);
		expect(saved[0]?.exportPath).toBe('~/Doc');
	});

	it('writes the pending value at once when the tab is left', async () => {
		const { saved, tab } = setUp();
		await tab.setControlValue('exportPath', '~/Exports');
		tab.hide();
		expect(saved.map((s) => s.exportPath)).toEqual(['~/Exports']);

		// And not a second time when the old timer would have fired.
		vi.advanceTimersByTime(1000);
		expect(saved).toHaveLength(1);
	});

	it('does not write when the tab is left with nothing typed', () => {
		const { saved, tab } = setUp();
		tab.hide();
		expect(saved).toHaveLength(0);
	});
});

describe('toggles and dropdowns', () => {
	it('are written at once — they change once per click', async () => {
		const { saved, tab } = setUp();
		await tab.setControlValue('autoClipboard', true);
		await tab.setControlValue('timestampFormat', 'iso');
		expect(saved.map((s) => [s.autoClipboard, s.timestampFormat])).toEqual([
			[true, 'readable'],
			[true, 'iso'],
		]);
	});
});

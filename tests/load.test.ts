/**
 * Settings read back from data.json, which anyone can edit. A field of the wrong
 * kind has to mean its default — a string "false" is truthy, and it used to turn
 * the save dialog on together with overwriting.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, settingsFrom } from '../src/settings.ts';

describe('settingsFrom', () => {
	it('keeps every field of the right kind', () => {
		const stored = {
			autoClipboard: true,
			askLocation: false,
			exportPath: '/Volumes/Backup',
			timestampFormat: 'iso',
		};
		expect(settingsFrom(stored)).toEqual(stored);
	});

	it('does not take a string for a switch', () => {
		for (const value of ['false', '0', 'true', '', 0, 1, null]) {
			expect(settingsFrom({ askLocation: value }).askLocation).toBe(DEFAULT_SETTINGS.askLocation);
			expect(settingsFrom({ autoClipboard: value }).autoClipboard).toBe(
				DEFAULT_SETTINGS.autoClipboard,
			);
		}
	});

	it('accepts only the two timestamp formats', () => {
		expect(settingsFrom({ timestampFormat: 'unix' }).timestampFormat).toBe(
			DEFAULT_SETTINGS.timestampFormat,
		);
	});

	it('survives a file that is not an object', () => {
		for (const stored of [null, undefined, [], 'abc', 5]) {
			expect(settingsFrom(stored)).toEqual(DEFAULT_SETTINGS);
		}
	});
});

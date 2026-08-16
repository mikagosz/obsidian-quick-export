import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Logic only — the host application is never started.
		include: ['tests/**/*.test.ts'],
		environment: 'node',

		// A plugin imports "obsidian", which does not exist under test, and this one
		// also imports "electron". Both are stubbed rather than avoided, because the
		// naming and path logic worth testing lives in the same file as the writes.
		alias: {
			obsidian: './tests/mocks/obsidian.ts',
			electron: './tests/mocks/electron.ts',
		},

		coverage: {
			reporter: ['text', 'html'],
			// No threshold to begin with. A threshold nobody enforces only buys
			// a red CI and a switched-off report.
			include: ['src/**/*.ts'],
		},
	},
});

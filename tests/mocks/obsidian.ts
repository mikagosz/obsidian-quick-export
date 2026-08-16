/**
 * Stands in for the `obsidian` package under test, as `vitest.config.ts` planned.
 *
 * The published package is types only, so any module importing `Notice` or
 * `MarkdownView` as a value cannot be loaded by the runner without this. Only
 * what `exporter.ts` touches at import time is here; anything else should fail
 * loudly rather than pretend to work.
 */

/** Records what the code would have shown, so a test can assert on it. */
export class Notice {
	static shown: string[] = [];

	constructor(message: string) {
		Notice.shown.push(message);
	}

	static reset(): void {
		Notice.shown = [];
	}
}

export class MarkdownView {}

/**
 * Stands in for the `obsidian` package under test, as `vitest.config.ts` planned.
 *
 * The published package is types only, so any module importing `Notice` or
 * `MarkdownView` as a value cannot be loaded by the runner without this. Only
 * what `exporter.ts` and `settings.ts` touch is here; anything else should fail
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

/** Obsidian's `debounce` with `resetTimer` set: each call restarts the wait. */
export function debounce<T extends unknown[]>(
	callback: (...args: T) => unknown,
	timeout = 0,
	_resetTimer = false,
) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let pending: T | undefined;
	const debounced = (...args: T) => {
		pending = args;
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => debounced.run(), timeout);
		return debounced;
	};
	debounced.cancel = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		pending = undefined;
		return debounced;
	};
	debounced.run = () => {
		if (pending === undefined) return;
		const args = pending;
		debounced.cancel();
		return callback(...args);
	};
	return debounced;
}

/** Enough of a settings tab to construct one; rendering is never exercised. */
export class PluginSettingTab {
	constructor(
		public app: unknown,
		public plugin: unknown,
	) {}

	hide(): void {}
}

export class Setting {}

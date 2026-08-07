/**
 * Obsidian's desktop shell exposes Electron's `remote` module for native
 * dialogs. There is no local Electron install to pull real types from
 * (only the runtime the app ships with), so this declares just the slice
 * this plugin calls.
 */
declare module 'electron' {
	export interface SaveDialogOptions {
		defaultPath?: string;
		filters?: { name: string; extensions: string[] }[];
	}

	export interface SaveDialogReturnValue {
		canceled: boolean;
		filePath?: string;
	}

	export interface Dialog {
		showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
	}

	export const remote: {
		dialog: Dialog;
	};
}

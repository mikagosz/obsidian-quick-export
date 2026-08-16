/**
 * Naming and path rules — everything the exporter decides before it touches the
 * disk.
 *
 * These are the parts that fail quietly: a name sanitised wrongly writes to a
 * path nobody expected, and a timestamp taken in UTC stamps yesterday's date on
 * an evening export. Both look like success.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFileName, resolveDir, sanitizeName } from '../src/exporter.ts';

describe('resolveDir', () => {
	it('expands a bare tilde to the home folder', () => {
		expect(resolveDir('~')).toBe(homedir());
	});

	it('expands a leading tilde in a longer path', () => {
		expect(resolveDir('~/Desktop')).toBe(join(homedir(), 'Desktop'));
	});

	it('leaves an absolute path alone', () => {
		expect(resolveDir('/Volumes/Backup/exports')).toBe('/Volumes/Backup/exports');
	});

	it('trims the surrounding whitespace a settings field collects', () => {
		expect(resolveDir('  /tmp/out  ')).toBe('/tmp/out');
	});

	// A tilde only means "home" at the start of a path; anywhere else it is an
	// ordinary character and must survive untouched.
	it('does not touch a tilde that is not the first character', () => {
		expect(resolveDir('/tmp/~backup')).toBe('/tmp/~backup');
	});
});

describe('sanitizeName', () => {
	it('replaces every character that is illegal in a file name', () => {
		expect(sanitizeName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
	});

	// A note titled "../../etc/passwd" must not be able to steer the write
	// anywhere: the separators go, so the name stays a name.
	it('cannot climb out of the export folder', () => {
		expect(sanitizeName('../../etc/passwd')).toBe('..-..-etc-passwd');
	});

	it('collapses runs of whitespace and trims the ends', () => {
		expect(sanitizeName('  meeting    notes  ')).toBe('meeting notes');
	});

	it('caps the length at 80 characters', () => {
		expect(sanitizeName('x'.repeat(200))).toHaveLength(80);
	});

	it('falls back to a name rather than writing to an empty one', () => {
		expect(sanitizeName('   ')).toBe('untitled');
		expect(sanitizeName('')).toBe('untitled');
	});

	// Not `untitled`: the slashes are replaced before the emptiness check, so the
	// name is `---` and the fallback never fires. Left as it is — `---` is a legal
	// file name, and the fallback is there for a genuinely empty one.
	it('turns a name made only of illegal characters into dashes, not the fallback', () => {
		expect(sanitizeName('///')).toBe('---');
	});

	it('keeps accented letters, which are legal and carry meaning', () => {
		expect(sanitizeName('Zapis sesji — część 2')).toBe('Zapis sesji — część 2');
	});
});

describe('buildFileName', () => {
	const file = (basename: string) => ({ basename }) as never;

	it('uses the note name, the timestamp and the format', () => {
		const name = buildFileName(file('Meeting notes'), {
			format: 'md',
			timestampFormat: 'readable',
		});
		expect(name).toMatch(/^Meeting notes-\d{4}-\d{2}-\d{2}_\d{6}\.md$/);
	});

	it('writes the expanded timestamp shape when asked for it', () => {
		const name = buildFileName(file('Note'), { format: 'txt', timestampFormat: 'iso' });
		expect(name).toMatch(/^Note-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.txt$/);
	});

	it('names an unsaved note rather than producing a leading dash', () => {
		expect(buildFileName(null, { format: 'md', timestampFormat: 'readable' })).toMatch(
			/^untitled-/,
		);
	});

	// The reason the timestamp is hand-rolled instead of toISOString(): UTC stamps
	// the previous day onto anything exported in the evening.
	it('stamps local time, not UTC', () => {
		const name = buildFileName(file('Note'), { format: 'md', timestampFormat: 'readable' });
		const now = new Date();
		const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
			now.getDate(),
		).padStart(2, '0')}`;
		expect(name).toContain(expected);
	});

	it('sanitises the note name on the way in', () => {
		expect(buildFileName(file('a/b'), { format: 'md', timestampFormat: 'readable' })).toMatch(
			/^a-b-/,
		);
	});
});

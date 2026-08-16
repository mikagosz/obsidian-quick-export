/**
 * Stands in for Electron under test.
 *
 * `remote` is deliberately undefined here: that is the shape the real module has
 * had since Electron 14, and Obsidian only puts it back at run time. Loading the
 * exporter against this proves the import survives its absence — which is the
 * whole point of typing it as optional.
 */

export const remote = undefined;

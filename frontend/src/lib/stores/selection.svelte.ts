/**
 * Selection store — tracks which element is currently selected.
 * Separate from elements store to keep concerns clean.
 *
 * In a visual editor, selection drives the UI:
 * - Resize handles appear around the selected element
 * - Properties panel shows selected element's data
 * - Layer panel highlights the selected row
 */

let selectedId = $state<string | null>(null);

export function getSelectedId(): string | null {
	return selectedId;
}

export function select(id: string | null): void {
	selectedId = id;
}

export function deselect(): void {
	selectedId = null;
}

export function isSelected(id: string): boolean {
	return selectedId === id;
}

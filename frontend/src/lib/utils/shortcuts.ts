/**
 * Keyboard shortcut handler for the visual editor.
 *
 * Registers global keydown listeners and dispatches to callbacks.
 * Ignores shortcuts when focus is inside input/textarea elements
 * to avoid interfering with text editing (e.g., Properties panel inputs).
 */

export interface ShortcutActions {
	onDelete: () => void;
	onEscape: () => void;
	onDuplicate: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onSelectAll: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onZoomReset: () => void;
}

/** Returns a cleanup function to remove the listener */
export function registerShortcuts(actions: ShortcutActions): () => void {
	function handler(e: KeyboardEvent) {
		// Don't intercept when typing in inputs
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		const meta = e.metaKey || e.ctrlKey;

		switch (e.key) {
			case 'Delete':
			case 'Backspace':
				e.preventDefault();
				actions.onDelete();
				break;

			case 'Escape':
				e.preventDefault();
				actions.onEscape();
				break;

			case 'd':
				if (meta) {
					e.preventDefault();
					actions.onDuplicate();
				}
				break;

			case 'z':
				if (meta && e.shiftKey) {
					e.preventDefault();
					actions.onRedo();
				} else if (meta) {
					e.preventDefault();
					actions.onUndo();
				}
				break;

			case 'a':
				if (meta) {
					e.preventDefault();
					actions.onSelectAll();
				}
				break;

			case '=':
			case '+':
				if (meta) {
					e.preventDefault();
					actions.onZoomIn();
				}
				break;

			case '-':
				if (meta) {
					e.preventDefault();
					actions.onZoomOut();
				}
				break;

			case '0':
				if (meta) {
					e.preventDefault();
					actions.onZoomReset();
				}
				break;
		}
	}

	window.addEventListener('keydown', handler);
	return () => window.removeEventListener('keydown', handler);
}

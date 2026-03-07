<!--
  Main editor page — 3-panel layout: LayerPanel (left), Canvas (center), PropertiesPanel (right).

  Data flow:
  - On mount: loads elements from Rails API (or uses seed data if API unavailable)
  - WASM modules initialized in parallel (non-blocking)
  - Drag/resize end: saves to Rails API, local diff computed via WASM
  - Phoenix broadcasts: update store reactively
  - Keyboard shortcuts: Delete, Escape, Cmd+D, Cmd+Z
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Canvas from '$lib/components/Canvas.svelte';
	import LayerPanel from '$lib/components/LayerPanel.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import PropertiesPanel from '$lib/components/PropertiesPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import {
		setElements,
		updateElement,
		addElement,
		removeElement,
		getNextZIndex,
		getElementById,
		getElementsSorted
	} from '$lib/stores/elements.svelte';
	import { deselect, getSelectedId, select } from '$lib/stores/selection.svelte';
	import { getZoom, setZoom, resetViewport } from '$lib/stores/viewport.svelte';
	import { registerShortcuts } from '$lib/utils/shortcuts';
	import * as api from '$lib/services/api';
	import { connectToCanvas, isConnected } from '$lib/services/socket.svelte';
	import { initWasm, getCurrentTier } from '$lib/wasm/loader';
	import { computeDelta } from '$lib/wasm/diff';
	import type { CanvasElement } from '$lib/types/element';

	/** Seed data for when Rails isn't running yet */
	const SEED_ELEMENTS: CanvasElement[] = [
		{
			id: 'seed-1',
			canvas_id: 'default',
			name: 'Blue Square',
			element_type: 'rectangle',
			x: 100,
			y: 100,
			width: 150,
			height: 150,
			rotation: 0,
			z_index: 1,
			styles: { backgroundColor: '#4f46e5', borderRadius: 8, opacity: 1 },
			locked: false,
			visible: true,
			version: 1
		},
		{
			id: 'seed-2',
			canvas_id: 'default',
			name: 'Green Rectangle',
			element_type: 'rectangle',
			x: 350,
			y: 200,
			width: 200,
			height: 120,
			rotation: 0,
			z_index: 2,
			styles: { backgroundColor: '#10b981', borderRadius: 4, opacity: 1 },
			locked: false,
			visible: true,
			version: 1
		},
		{
			id: 'seed-3',
			canvas_id: 'default',
			name: 'Red Circle',
			element_type: 'rectangle',
			x: 600,
			y: 150,
			width: 120,
			height: 120,
			rotation: 0,
			z_index: 3,
			styles: { backgroundColor: '#ef4444', borderRadius: 60, opacity: 0.9 },
			locked: false,
			visible: true,
			version: 1
		}
	];

	let apiAvailable = $state(false);

	// Track connection state reactively
	let socketConnected = $derived(isConnected());

	let cleanupShortcuts: (() => void) | null = null;

	onMount(async () => {
		// Initialize WASM modules in parallel (non-blocking, progressive enhancement)
		initWasm().then((tier) => {
			console.info(`[page] WASM ready — Tier ${tier}`);
		});

		// Try loading from Rails API; fall back to seed data
		try {
			const elements = await api.fetchElements('default');
			setElements(elements);
			apiAvailable = true;
		} catch {
			console.info('[page] Rails API unavailable, using seed data');
			setElements(SEED_ELEMENTS);
		}

		// Try connecting to Phoenix
		connectToCanvas('default');

		// Register keyboard shortcuts
		cleanupShortcuts = registerShortcuts({
			onDelete: () => {
				const id = getSelectedId();
				if (id) handleDeleteElement(id);
			},
			onEscape: () => {
				deselect();
			},
			onDuplicate: () => {
				const id = getSelectedId();
				if (id) handleDuplicate(id);
			},
			onUndo: () => {
				// Stub — undo will use element_histories table in Phase 6
				console.info('[shortcuts] Undo (not yet implemented)');
			},
			onRedo: () => {
				console.info('[shortcuts] Redo (not yet implemented)');
			},
			onSelectAll: () => {
				// Select first element as a starting point
				const sorted = getElementsSorted();
				if (sorted.length > 0) select(sorted[0].id);
			},
			onZoomIn: () => setZoom(getZoom() + 0.1),
			onZoomOut: () => setZoom(getZoom() - 0.1),
			onZoomReset: () => resetViewport()
		});
	});

	onDestroy(() => {
		cleanupShortcuts?.();
	});

	/** Save position after drag ends — computes local diff for instant preview */
	async function handleDragEnd(id: string, x: number, y: number) {
		const el = getElementById(id);
		if (el) {
			// Compute local diff via WASM for instant undo history / change indicators
			const prevSnapshot = { ...el, x: el.x, y: el.y };
			const currSnapshot = { ...el, x, y };
			const delta = computeDelta(prevSnapshot as CanvasElement, currSnapshot as CanvasElement);
			if (delta) {
				console.debug('[wasm-diff] Local drag delta:', delta);
			}
		}

		if (!apiAvailable) return;
		try {
			const updated = await api.updateElement(id, { x, y });
			updateElement(id, updated);
		} catch (err) {
			console.error('[page] Failed to save drag:', err);
		}
	}

	/** Save dimensions after resize ends — computes local diff for instant preview */
	async function handleResizeEnd(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number
	) {
		const el = getElementById(id);
		if (el) {
			const prevSnapshot = { ...el };
			const currSnapshot = { ...el, x, y, width, height };
			const delta = computeDelta(prevSnapshot as CanvasElement, currSnapshot as CanvasElement);
			if (delta) {
				console.debug('[wasm-diff] Local resize delta:', delta);
			}
		}

		if (!apiAvailable) return;
		try {
			const updated = await api.updateElement(id, { x, y, width, height });
			updateElement(id, updated);
		} catch (err) {
			console.error('[page] Failed to save resize:', err);
		}
	}

	/** Add a new element */
	async function handleAddElement() {
		const newEl: Partial<CanvasElement> = {
			canvas_id: 'default',
			name: `Element ${getNextZIndex()}`,
			element_type: 'rectangle',
			x: 200 + Math.random() * 200,
			y: 150 + Math.random() * 200,
			width: 150,
			height: 100,
			rotation: 0,
			z_index: getNextZIndex(),
			styles: {
				backgroundColor: `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`,
				borderRadius: 4,
				opacity: 1
			},
			locked: false,
			visible: true
		};

		if (apiAvailable) {
			try {
				const created = await api.createElement(newEl);
				addElement(created);
				select(created.id);
			} catch (err) {
				console.error('[page] Failed to create element:', err);
			}
		} else {
			const el = {
				...newEl,
				id: `local-${Date.now()}`,
				version: 1
			} as CanvasElement;
			addElement(el);
			select(el.id);
		}
	}

	/** Delete the selected element */
	async function handleDeleteElement(id: string) {
		if (getSelectedId() === id) deselect();
		removeElement(id);

		if (apiAvailable) {
			try {
				await api.deleteElement(id);
			} catch (err) {
				console.error('[page] Failed to delete element:', err);
			}
		}
	}

	/** Duplicate an element */
	async function handleDuplicate(id: string) {
		const el = getElementById(id);
		if (!el) return;

		const newEl: Partial<CanvasElement> = {
			canvas_id: el.canvas_id,
			name: `${el.name} (copy)`,
			element_type: el.element_type,
			x: el.x + 20,
			y: el.y + 20,
			width: el.width,
			height: el.height,
			rotation: el.rotation,
			z_index: getNextZIndex(),
			styles: { ...el.styles },
			locked: false,
			visible: true
		};

		if (apiAvailable) {
			try {
				const created = await api.createElement(newEl);
				addElement(created);
				select(created.id);
			} catch (err) {
				console.error('[page] Failed to duplicate:', err);
			}
		} else {
			const localEl = {
				...newEl,
				id: `local-${Date.now()}`,
				version: 1
			} as CanvasElement;
			addElement(localEl);
			select(localEl.id);
		}
	}

	/** Update style properties */
	async function handleUpdateStyle(id: string, styles: Record<string, unknown>) {
		const el = getElementById(id);
		if (!el) return;

		const merged = { ...el.styles, ...styles };
		updateElement(id, { styles: merged });

		if (apiAvailable) {
			try {
				await api.updateElement(id, { styles: merged });
			} catch (err) {
				console.error('[page] Failed to update style:', err);
			}
		}
	}

	/** Update element properties (position, size, lock, visibility) */
	async function handleUpdateElement(id: string, updates: Partial<CanvasElement>) {
		updateElement(id, updates);

		if (apiAvailable) {
			try {
				await api.updateElement(id, updates);
			} catch (err) {
				console.error('[page] Failed to update element:', err);
			}
		}
	}

	/** Reorder layer z-index */
	async function handleReorder(id: string, newZIndex: number) {
		updateElement(id, { z_index: newZIndex });

		if (apiAvailable) {
			try {
				await api.updateElement(id, { z_index: newZIndex });
			} catch (err) {
				console.error('[page] Failed to reorder:', err);
			}
		}
	}

	/** Toggle lock state and persist */
	async function handleToggleLock(id: string, locked: boolean) {
		if (apiAvailable) {
			try {
				await api.updateElement(id, { locked });
			} catch (err) {
				console.error('[page] Failed to toggle lock:', err);
			}
		}
	}

	/** Toggle visibility and persist */
	async function handleToggleVisible(id: string, visible: boolean) {
		if (apiAvailable) {
			try {
				await api.updateElement(id, { visible });
			} catch (err) {
				console.error('[page] Failed to toggle visibility:', err);
			}
		}
	}

	// Derive selected element for properties panel
	let selectedElement = $derived(getSelectedId() ? getElementById(getSelectedId()!) : undefined);
</script>

<svelte:head>
	<title>Visual Editor</title>
</svelte:head>

<div class="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950">
	<!-- Toolbar (top) -->
	<Toolbar
		onAddElement={handleAddElement}
		onDeleteElement={handleDeleteElement}
		onUpdateStyle={handleUpdateStyle}
	/>

	<!-- Main 3-panel body -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Left: Layer Panel -->
		<LayerPanel
			onReorder={handleReorder}
			onDelete={handleDeleteElement}
			onToggleLock={handleToggleLock}
			onToggleVisible={handleToggleVisible}
		/>

		<!-- Center: Canvas -->
		<Canvas onDragEnd={handleDragEnd} onResizeEnd={handleResizeEnd} />

		<!-- Right: Properties Panel -->
		<PropertiesPanel
			element={selectedElement}
			onUpdate={handleUpdateElement}
			onUpdateStyle={handleUpdateStyle}
		/>
	</div>

	<!-- Status Bar (bottom) -->
	<StatusBar
		connected={socketConnected}
		zoom={getZoom()}
		elementCount={getElementsSorted().length}
	/>
</div>

<!--
  Canvas.svelte — the main editing surface with zoom/pan support.

  Handles all pointer interactions: selection, dragging, resizing.
  Supports:
  - Scroll wheel zoom (Ctrl/Cmd + wheel)
  - Middle-click pan
  - Grid snapping during drag
  - Dimension labels during drag/resize
  - Proper pointer capture release (fixes pointer capture leak bug)

  ## WebGPU Integration (Progressive Enhancement)

  When WebGPU is available (Tier 3), elements are rendered via GPU-accelerated
  instanced quads with SDF rounded rects. A transparent <div> overlay captures
  pointer events, while the <canvas> handles rendering.

  When WebGPU is unavailable, falls back to DOM-based rendering (existing code).
  Selection overlay and dimension labels are always DOM (UI chrome).

  ## WASM Hit Testing

  When wasm-spatial is loaded, click hit testing uses the R-tree index
  for O(log n) lookups instead of iterating all DOM elements.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import CanvasElementComponent from './CanvasElement.svelte';
	import SelectionOverlay from './SelectionOverlay.svelte';
	import DimensionLabel from './DimensionLabel.svelte';
	import {
		getElementsSorted,
		getElementById,
		updateElement
	} from '$lib/stores/elements.svelte';
	import { getSelectedId, select, deselect } from '$lib/stores/selection.svelte';
	import { resizeFromHandle, type HandlePosition } from '$lib/utils/geometry';
	import {
		getZoom,
		getPan,
		panBy,
		zoomToward,
		snapToGrid,
		getShowGrid,
		getGridSize,
		screenToCanvas
	} from '$lib/stores/viewport.svelte';
	import * as spatialIndex from '$lib/wasm/spatial';
	import { WebGpuRenderer } from '$lib/wasm/render';

	interface Props {
		onDragEnd: (id: string, x: number, y: number) => void;
		onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void;
	}

	let { onDragEnd, onResizeEnd }: Props = $props();

	// Drag state — dragging and dragId are reactive (used in template for DimensionLabel)
	let dragging = $state(false);
	let dragId = $state<string | null>(null);
	let dragOffsetX = 0;
	let dragOffsetY = 0;
	let dragPointerId: number | null = null;
	let dragTarget: HTMLElement | null = null;

	// Resize state
	let resizing = $state(false);
	let resizeHandle: HandlePosition | null = null;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeOriginal = { x: 0, y: 0, width: 0, height: 0 };

	// Pan state (middle-click pan)
	let panning = false;
	let panStartX = 0;
	let panStartY = 0;

	let canvasEl: HTMLDivElement;

	// WebGPU state
	let useWebGPU = $state(false);
	let gpuCanvas: HTMLCanvasElement | undefined = $state();
	let renderer: WebGpuRenderer | null = null;
	let animFrameId: number | null = null;

	/** Export dragging state so elements store can skip remote deltas during drag */
	export function getDragId(): string | null {
		return dragId;
	}

	// ── WebGPU lifecycle ──

	async function tryInitWebGPU() {
		if (!WebGpuRenderer.isSupported() || !gpuCanvas) return;
		renderer = await WebGpuRenderer.create(gpuCanvas);
		if (renderer) {
			useWebGPU = true;
			console.info('[Canvas] WebGPU renderer active (Tier 3)');
			startRenderLoop();
		} else {
			console.info('[Canvas] WebGPU init failed, using DOM rendering (Tier 0-2)');
		}
	}

	// Use $effect to react when gpuCanvas becomes available
	$effect(() => {
		if (gpuCanvas && !renderer) {
			tryInitWebGPU();
		}
	});

	onDestroy(() => {
		if (animFrameId !== null) {
			cancelAnimationFrame(animFrameId);
		}
		renderer?.destroy();
	});

	function startRenderLoop(): void {
		function frame() {
			if (!renderer || !gpuCanvas) return;

			// Resize canvas to match display size
			const dpr = window.devicePixelRatio || 1;
			const rect = gpuCanvas.getBoundingClientRect();
			const width = Math.round(rect.width * dpr);
			const height = Math.round(rect.height * dpr);
			if (gpuCanvas.width !== width || gpuCanvas.height !== height) {
				gpuCanvas.width = width;
				gpuCanvas.height = height;
			}

			// Update GPU buffers
			const zoom = getZoom();
			const pan = getPan();
			renderer.updateViewport(zoom, pan.x, pan.y);
			renderer.updateGrid(getGridSize(), getShowGrid());
			renderer.updateElements(getElementsSorted(), getSelectedId());

			// Execute render pass
			renderer.render();

			animFrameId = requestAnimationFrame(frame);
		}
		animFrameId = requestAnimationFrame(frame);
	}

	// ── Hit testing ──

	function hitTestAtPoint(screenX: number, screenY: number): string | null {
		const canvasCoords = screenToCanvas(screenX, screenY);

		// Use WASM spatial index when available (O(log n))
		if (spatialIndex.isLoaded()) {
			return spatialIndex.hitTest(canvasCoords.x, canvasCoords.y, getElementsSorted());
		}

		// JS fallback: linear scan (sorted by z_index descending for top-first)
		const sorted = [...getElementsSorted()].reverse();
		for (const el of sorted) {
			if (!el.visible || el.locked) continue;
			if (
				canvasCoords.x >= el.x &&
				canvasCoords.x <= el.x + el.width &&
				canvasCoords.y >= el.y &&
				canvasCoords.y <= el.y + el.height
			) {
				return el.id;
			}
		}
		return null;
	}

	function handleCanvasPointerDown(e: PointerEvent) {
		// Middle-click → start panning
		if (e.button === 1) {
			e.preventDefault();
			panning = true;
			panStartX = e.clientX;
			panStartY = e.clientY;
			canvasEl.setPointerCapture(e.pointerId);
			return;
		}

		// Left-click: try WASM hit testing first (works for both WebGPU and DOM modes)
		if (e.button === 0) {
			const hitId = hitTestAtPoint(e.clientX, e.clientY);
			if (hitId) {
				select(hitId);
				// Start drag on the hit element
				const el = getElementById(hitId);
				if (el) {
					const zoom = getZoom();
					const pan = getPan();
					dragging = true;
					dragId = hitId;
					dragOffsetX = e.clientX - (el.x * zoom + pan.x);
					dragOffsetY = e.clientY - (el.y * zoom + pan.y);
					dragPointerId = e.pointerId;
					dragTarget = e.target as HTMLElement;
					dragTarget.setPointerCapture(e.pointerId);
				}
				return;
			}

			// Click on empty canvas → deselect
			if (
				e.target === canvasEl ||
				(e.target as HTMLElement).classList.contains('grid-pattern') ||
				(e.target as HTMLElement).classList.contains('gpu-overlay')
			) {
				deselect();
			}
		}
	}

	function handleDragStart(id: string, e: PointerEvent) {
		const el = getElementById(id);
		if (!el) return;

		const zoom = getZoom();
		const pan = getPan();

		dragging = true;
		dragId = id;
		dragOffsetX = e.clientX - (el.x * zoom + pan.x);
		dragOffsetY = e.clientY - (el.y * zoom + pan.y);
		dragPointerId = e.pointerId;
		dragTarget = e.target as HTMLElement;

		dragTarget.setPointerCapture(e.pointerId);
	}

	function handleResizeStart(handle: HandlePosition, e: PointerEvent) {
		const id = getSelectedId();
		if (!id) return;

		const el = getElementById(id);
		if (!el) return;

		resizing = true;
		resizeHandle = handle;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeOriginal = { x: el.x, y: el.y, width: el.width, height: el.height };
	}

	function handlePointerMove(e: PointerEvent) {
		// Pan
		if (panning) {
			const dx = e.clientX - panStartX;
			const dy = e.clientY - panStartY;
			panBy(dx, dy);
			panStartX = e.clientX;
			panStartY = e.clientY;
			return;
		}

		// Drag
		if (dragging && dragId) {
			const zoom = getZoom();
			const pan = getPan();

			let newX = (e.clientX - dragOffsetX - pan.x) / zoom;
			let newY = (e.clientY - dragOffsetY - pan.y) / zoom;

			// Snap to grid
			newX = snapToGrid(newX);
			newY = snapToGrid(newY);

			updateElement(dragId, { x: newX, y: newY });
		}

		// Resize
		if (resizing && resizeHandle) {
			const id = getSelectedId();
			if (!id) return;

			const zoom = getZoom();
			const dx = (e.clientX - resizeStartX) / zoom;
			const dy = (e.clientY - resizeStartY) / zoom;
			const newRect = resizeFromHandle(resizeOriginal, resizeHandle, dx, dy);

			// Snap position to grid
			newRect.x = snapToGrid(newRect.x);
			newRect.y = snapToGrid(newRect.y);

			updateElement(id, newRect);
		}
	}

	function handlePointerUp(e: PointerEvent) {
		// End pan
		if (panning) {
			panning = false;
			try { canvasEl.releasePointerCapture(e.pointerId); } catch {}
			return;
		}

		// End drag — release pointer capture to prevent leak
		if (dragging && dragId) {
			if (dragTarget && dragPointerId !== null) {
				try { dragTarget.releasePointerCapture(dragPointerId); } catch {}
			}

			const el = getElementById(dragId);
			if (el) {
				onDragEnd(dragId, el.x, el.y);
			}
			dragging = false;
			dragId = null;
			dragTarget = null;
			dragPointerId = null;
		}

		// End resize
		if (resizing) {
			const id = getSelectedId();
			if (id) {
				const el = getElementById(id);
				if (el) {
					onResizeEnd(id, el.x, el.y, el.width, el.height);
				}
			}
			resizing = false;
			resizeHandle = null;
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();

		if (e.ctrlKey || e.metaKey) {
			// Zoom
			zoomToward(e.deltaY, e.clientX, e.clientY);
		} else {
			// Pan
			panBy(-e.deltaX, -e.deltaY);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative flex-1 overflow-hidden bg-zinc-950 cursor-default"
	bind:this={canvasEl}
	onpointerdown={handleCanvasPointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onwheel={handleWheel}
>
	<!-- WebGPU canvas (always in DOM for binding, hidden when not active) -->
	<canvas
		bind:this={gpuCanvas}
		class="absolute inset-0 w-full h-full"
		style:z-index="0"
		style:display={useWebGPU ? 'block' : 'none'}
	></canvas>
	{#if useWebGPU}
		<!-- Transparent overlay for pointer events (elements rendered by GPU) -->
		<div class="gpu-overlay absolute inset-0" style:z-index="1"></div>
	{:else}
		<!-- DOM rendering fallback (Tier 0-2) -->

		<!-- Grid background pattern -->
		{#if getShowGrid()}
			{@const zoom = getZoom()}
			{@const pan = getPan()}
			{@const gridSize = getGridSize()}
			<div
				class="grid-pattern pointer-events-none absolute inset-0 opacity-30"
				style:background-image="radial-gradient(circle, rgb(63 63 70) 1px, transparent 1px)"
				style:background-size="{gridSize * zoom}px {gridSize * zoom}px"
				style:background-position="{pan.x}px {pan.y}px"
			></div>
		{/if}

		<!-- Canvas elements -->
		{#each getElementsSorted() as element (element.id)}
			<CanvasElementComponent
				{element}
				zoom={getZoom()}
				panX={getPan().x}
				panY={getPan().y}
				onDragStart={handleDragStart}
			/>
		{/each}
	{/if}

	<!-- Selection overlay for selected element (always DOM, works in both modes) -->
	{#if getSelectedId()}
		{@const selectedEl = getElementById(getSelectedId()!)}
		{#if selectedEl}
			<SelectionOverlay
				element={selectedEl}
				zoom={getZoom()}
				panX={getPan().x}
				panY={getPan().y}
				onResizeStart={handleResizeStart}
			/>
		{/if}
	{/if}

	<!-- Dimension label during drag or resize -->
	{#if dragging && dragId}
		{@const dragEl = getElementById(dragId)}
		{#if dragEl}
			<DimensionLabel
				x={dragEl.x}
				y={dragEl.y}
				width={dragEl.width}
				height={dragEl.height}
				zoom={getZoom()}
			/>
		{/if}
	{/if}

	{#if resizing && getSelectedId()}
		{@const resizeEl = getElementById(getSelectedId()!)}
		{#if resizeEl}
			<DimensionLabel
				x={resizeEl.x}
				y={resizeEl.y}
				width={resizeEl.width}
				height={resizeEl.height}
				zoom={getZoom()}
			/>
		{/if}
	{/if}
</div>

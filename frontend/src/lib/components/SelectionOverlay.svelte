<!--
  SelectionOverlay.svelte — Figma-style resize handles around the selected element.

  Renders 8 circular handles (corners + edge midpoints) positioned
  over the selected element. Each handle emits resize events.

  Uses wasm-geom compute_handles() when loaded for all 8 handle positions
  in a single WASM call (avoids 8 separate JS calculations).
-->
<script lang="ts">
	import type { CanvasElement } from '$lib/types/element';
	import { HANDLE_SIZE, getHandleCursor, type HandlePosition } from '$lib/utils/geometry';
	import { computeHandles } from '$lib/wasm/geom';

	interface Props {
		element: CanvasElement;
		zoom?: number;
		panX?: number;
		panY?: number;
		onResizeStart: (handle: HandlePosition, e: PointerEvent) => void;
	}

	let { element, zoom = 1, panX = 0, panY = 0, onResizeStart }: Props = $props();

	const handles: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

	/**
	 * Get all 8 handle positions in one call via wasm-geom.
	 * Returns 16 floats: [nw_x, nw_y, n_x, n_y, ..., w_x, w_y]
	 */
	function getAllHandlePositions(): number[] {
		return computeHandles(element.x, element.y, element.width, element.height, zoom, panX, panY);
	}

	function getHandlePosition(handle: HandlePosition, positions: number[]): { cx: number; cy: number } {
		const idx = handles.indexOf(handle) * 2;
		return { cx: positions[idx], cy: positions[idx + 1] };
	}

	/** All 8 handle positions, recomputed when element/viewport changes */
	let handlePositions = $derived(getAllHandlePositions());

	function getHandlePos(index: number): { cx: number; cy: number } {
		return { cx: handlePositions[index * 2], cy: handlePositions[index * 2 + 1] };
	}

	function handlePointerDown(handle: HandlePosition, e: PointerEvent) {
		e.stopPropagation();
		e.preventDefault();
		onResizeStart(handle, e);
	}
</script>

<!-- Bounding box outline -->
<div
	class="pointer-events-none absolute top-0 left-0 border border-blue-500"
	style:transform="translate({element.x * zoom + panX}px, {element.y * zoom + panY}px)"
	style:width="{element.width * zoom}px"
	style:height="{element.height * zoom}px"
	style:z-index="9999"
></div>

<!-- Dimension readout above element -->
<div
	class="pointer-events-none absolute z-[10001] -translate-x-1/2 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-mono text-white shadow"
	style:left="{element.x * zoom + panX + (element.width * zoom) / 2}px"
	style:top="{element.y * zoom + panY - 22}px"
>
	{Math.round(element.width)} &times; {Math.round(element.height)}
</div>

{#each handles as handle, i}
	{@const pos = getHandlePos(i)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute z-[10000] rounded-full border-[1.5px] border-blue-500 bg-white shadow-sm transition-colors hover:bg-blue-500 pointer-events-auto"
		style:left="{pos.cx - HANDLE_SIZE / 2}px"
		style:top="{pos.cy - HANDLE_SIZE / 2}px"
		style:width="{HANDLE_SIZE}px"
		style:height="{HANDLE_SIZE}px"
		style:cursor={getHandleCursor(handle)}
		onpointerdown={(e) => handlePointerDown(handle, e)}
	></div>
{/each}

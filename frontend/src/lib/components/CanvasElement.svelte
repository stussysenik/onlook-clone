<!--
  CanvasElement.svelte — renders a single visual element on the canvas.

  Uses `transform: translate()` for GPU-accelerated positioning.
  Tailwind classes for all styling. Hover glow effect on elements.
-->
<script lang="ts">
	import type { CanvasElement as ElementType } from '$lib/types/element';
	import { isSelected, select } from '$lib/stores/selection.svelte';

	interface Props {
		element: ElementType;
		zoom?: number;
		panX?: number;
		panY?: number;
		onDragStart: (id: string, e: PointerEvent) => void;
	}

	let { element, zoom = 1, panX = 0, panY = 0, onDragStart }: Props = $props();

	function handlePointerDown(e: PointerEvent) {
		e.stopPropagation();
		if (element.locked) return;
		select(element.id);
		onDragStart(element.id, e);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute top-0 left-0 box-border select-none will-change-transform
		{element.locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
		{isSelected(element.id) ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-transparent' : ''}
		{!isSelected(element.id) && !element.locked ? 'hover:ring-1 hover:ring-blue-400/40' : ''}"
	style:transform="translate({element.x * zoom + panX}px, {element.y * zoom + panY}px) rotate({element.rotation}deg)"
	style:width="{element.width * zoom}px"
	style:height="{element.height * zoom}px"
	style:z-index={element.z_index}
	style:background-color={element.styles.backgroundColor ?? '#4f46e5'}
	style:border-radius="{(element.styles.borderRadius ?? 0) * zoom}px"
	style:opacity={element.visible ? (element.styles.opacity ?? 1) : 0}
	style:border-width="{(element.styles.borderWidth ?? 0)}px"
	style:border-color={element.styles.borderColor ?? 'transparent'}
	style:border-style="solid"
	style:pointer-events={element.visible ? 'auto' : 'none'}
	onpointerdown={handlePointerDown}
>
	{#if zoom >= 0.5}
		<span class="pointer-events-none absolute left-1.5 top-1 text-[11px] text-white/70 drop-shadow-sm">
			{element.name}
		</span>
	{/if}
</div>

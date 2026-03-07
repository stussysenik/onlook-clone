<!--
  DimensionLabel.svelte — floating label showing position and size during drag/resize.

  Positioned just below the element being manipulated, shows:
  - Position: "X: 100  Y: 200"
  - Size: "150 × 120"
-->
<script lang="ts">
	interface Props {
		x: number;
		y: number;
		width: number;
		height: number;
		zoom?: number;
	}

	let { x, y, width, height, zoom = 1 }: Props = $props();
</script>

<div
	class="pointer-events-none absolute z-[10001] flex gap-3 rounded-md bg-zinc-900/90 px-2.5 py-1 text-[11px] font-mono text-zinc-300 shadow-lg border border-zinc-700/50 backdrop-blur-sm"
	style:left="{x * zoom}px"
	style:top="{(y + height) * zoom + 8}px"
>
	<span>
		<span class="text-zinc-500">X</span> {Math.round(x)}
		<span class="ml-2 text-zinc-500">Y</span> {Math.round(y)}
	</span>
	<span class="text-zinc-600">|</span>
	<span>
		{Math.round(width)} <span class="text-zinc-500">&times;</span> {Math.round(height)}
	</span>
</div>

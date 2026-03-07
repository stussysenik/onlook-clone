<!--
  StatusBar.svelte — bottom bar showing editor state at a glance.

  Displays: connection status, zoom level, canvas name, element count.
  Sits at the very bottom of the editor layout.
-->
<script lang="ts">
	import { Wifi, WifiOff, ZoomIn } from 'lucide-svelte';

	interface Props {
		connected: boolean;
		zoom: number;
		elementCount: number;
		canvasId?: string;
	}

	let { connected, zoom, elementCount, canvasId = 'default' }: Props = $props();
</script>

<div class="flex h-7 items-center gap-0 border-t border-zinc-800 bg-zinc-950 px-1 text-[11px] text-zinc-500 select-none">
	<!-- Connection status -->
	<div class="flex items-center gap-1.5 px-3 border-r border-zinc-800 h-full">
		{#if connected}
			<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
			<Wifi class="h-3 w-3 text-emerald-500" />
			<span class="text-emerald-500">Connected</span>
		{:else}
			<span class="h-1.5 w-1.5 rounded-full bg-zinc-600"></span>
			<WifiOff class="h-3 w-3" />
			<span>Offline</span>
		{/if}
	</div>

	<!-- Zoom -->
	<div class="flex items-center gap-1.5 px-3 border-r border-zinc-800 h-full">
		<ZoomIn class="h-3 w-3" />
		<span>{Math.round(zoom * 100)}%</span>
	</div>

	<!-- Canvas name -->
	<div class="flex items-center px-3 border-r border-zinc-800 h-full">
		<span>Canvas: {canvasId}</span>
	</div>

	<!-- Element count -->
	<div class="flex items-center px-3 h-full">
		<span>{elementCount} element{elementCount !== 1 ? 's' : ''}</span>
	</div>

	<!-- Spacer -->
	<div class="flex-1"></div>
</div>

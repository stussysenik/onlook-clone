<!--
  Toolbar.svelte — top bar with tool mode selector, add/delete actions, and style controls.

  Uses Tailwind classes and Lucide icons for a production-quality Onlook/Figma look.
  Grouped into: tool modes | add/insert | style controls | delete.
-->
<script lang="ts">
	import {
		MousePointer2,
		Plus,
		Trash2,
		Play,
		Settings
	} from 'lucide-svelte';
	import { getElementById } from '$lib/stores/elements.svelte';
	import { getSelectedId } from '$lib/stores/selection.svelte';
	import { getZoom, setZoom, getToolMode, setToolMode, type ToolMode } from '$lib/stores/viewport.svelte';

	interface Props {
		onAddElement: () => void;
		onDeleteElement: (id: string) => void;
		onUpdateStyle: (id: string, styles: Record<string, unknown>) => void;
	}

	let { onAddElement, onDeleteElement, onUpdateStyle }: Props = $props();

	let colorValue = $state('#4f46e5');
	let opacityValue = $state(1);

	// Sync toolbar with selected element
	$effect(() => {
		const id = getSelectedId();
		if (id) {
			const el = getElementById(id);
			if (el) {
				colorValue = el.styles.backgroundColor ?? '#4f46e5';
				opacityValue = el.styles.opacity ?? 1;
			}
		}
	});

	function handleColorChange(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		colorValue = value;
		const id = getSelectedId();
		if (id) onUpdateStyle(id, { backgroundColor: value });
	}

	function handleOpacityChange(e: Event) {
		const value = parseFloat((e.target as HTMLInputElement).value);
		opacityValue = value;
		const id = getSelectedId();
		if (id) onUpdateStyle(id, { opacity: value });
	}

	function handleToolModeChange(mode: ToolMode) {
		setToolMode(mode);
	}
</script>

<div class="flex h-11 items-center gap-1 border-b border-zinc-800 bg-zinc-950 px-2 select-none">
	<!-- Tool mode selector -->
	<div class="flex items-center gap-0.5 rounded-md bg-zinc-900 p-0.5">
		<button
			onclick={() => handleToolModeChange('select')}
			class="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors {getToolMode() === 'select' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}"
			title="Select tool (V)"
		>
			<MousePointer2 class="h-3.5 w-3.5" />
			Select
		</button>
	</div>

	<!-- Separator -->
	<div class="mx-1 h-5 w-px bg-zinc-800"></div>

	<!-- Add element -->
	<button
		onclick={onAddElement}
		class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
		title="Add element"
	>
		<Plus class="h-3.5 w-3.5" />
		Insert
	</button>

	{#if getSelectedId()}
		<!-- Separator -->
		<div class="mx-1 h-5 w-px bg-zinc-800"></div>

		<!-- Color picker -->
		<div class="flex items-center gap-1.5">
			<span class="text-[11px] text-zinc-500">Fill</span>
			<div class="relative">
				<input
					type="color"
					value={colorValue}
					oninput={handleColorChange}
					class="h-6 w-6 cursor-pointer rounded border border-zinc-700 bg-transparent p-0.5"
				/>
			</div>
		</div>

		<!-- Opacity -->
		<div class="flex items-center gap-1.5 ml-2">
			<span class="text-[11px] text-zinc-500">Opacity</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={opacityValue}
				oninput={handleOpacityChange}
				class="h-1 w-16 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-blue-500"
			/>
			<span class="min-w-[28px] text-[11px] text-zinc-400">{Math.round(opacityValue * 100)}%</span>
		</div>

		<!-- Separator -->
		<div class="mx-1 h-5 w-px bg-zinc-800"></div>

		<!-- Delete -->
		<button
			onclick={() => { const id = getSelectedId(); if (id) onDeleteElement(id); }}
			class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-400/10"
			title="Delete element"
		>
			<Trash2 class="h-3.5 w-3.5" />
		</button>
	{/if}

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Zoom display -->
	<div class="flex items-center gap-1 mr-1">
		<button
			onclick={() => setZoom(getZoom() - 0.1)}
			class="rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
		>
			-
		</button>
		<span class="min-w-[36px] text-center text-[11px] text-zinc-500">{Math.round(getZoom() * 100)}%</span>
		<button
			onclick={() => setZoom(getZoom() + 0.1)}
			class="rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
		>
			+
		</button>
	</div>

	<!-- Separator -->
	<div class="mx-1 h-5 w-px bg-zinc-800"></div>

	<!-- Right-side actions -->
	<button
		class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-emerald-400 transition-colors hover:bg-emerald-400/10"
		title="Run preview"
	>
		<Play class="h-3.5 w-3.5" />
	</button>
	<button
		class="flex items-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
		title="Settings"
	>
		<Settings class="h-3.5 w-3.5" />
	</button>
</div>

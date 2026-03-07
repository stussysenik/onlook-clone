<!--
  PropertiesPanel.svelte — right sidebar showing properties of the selected element.

  Displays numeric inputs for position (x/y), size (w/h), rotation,
  style controls (fill color, border radius, opacity), and toggles
  for locked/visible state.

  All changes are applied optimistically then persisted via onUpdate callback.
-->
<script lang="ts">
	import {
		Move,
		Maximize2,
		RotateCw,
		Paintbrush,
		Circle,
		SlidersHorizontal,
		Lock,
		Unlock,
		Eye,
		EyeOff
	} from 'lucide-svelte';
	import type { CanvasElement } from '$lib/types/element';

	interface Props {
		element: CanvasElement | undefined;
		onUpdate: (id: string, updates: Partial<CanvasElement>) => void;
		onUpdateStyle: (id: string, styles: Record<string, unknown>) => void;
	}

	let { element, onUpdate, onUpdateStyle }: Props = $props();

	function handleNumericInput(
		field: keyof CanvasElement,
		e: Event
	) {
		if (!element) return;
		const value = parseFloat((e.target as HTMLInputElement).value);
		if (isNaN(value)) return;
		onUpdate(element.id, { [field]: value });
	}

	function handleStyleInput(field: string, e: Event) {
		if (!element) return;
		const input = e.target as HTMLInputElement;
		let value: unknown = input.value;
		if (input.type === 'number' || input.type === 'range') {
			value = parseFloat(input.value);
			if (isNaN(value as number)) return;
		}
		onUpdateStyle(element.id, { [field]: value });
	}

	function toggleLock() {
		if (!element) return;
		onUpdate(element.id, { locked: !element.locked });
	}

	function toggleVisible() {
		if (!element) return;
		onUpdate(element.id, { visible: !element.visible });
	}
</script>

<div class="flex h-full w-[260px] flex-col border-l border-zinc-800 bg-zinc-950">
	<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
		<span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Properties</span>
	</div>

	{#if element}
		<div class="flex-1 overflow-y-auto p-3 space-y-4">
			<!-- Position -->
			<section>
				<div class="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
					<Move class="h-3 w-3" />
					Position
				</div>
				<div class="grid grid-cols-2 gap-2">
					<label class="flex flex-col gap-1">
						<span class="text-[10px] text-zinc-500">X</span>
						<input
							type="number"
							value={Math.round(element.x)}
							onchange={(e) => handleNumericInput('x', e)}
							class="h-7 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700"
						/>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-[10px] text-zinc-500">Y</span>
						<input
							type="number"
							value={Math.round(element.y)}
							onchange={(e) => handleNumericInput('y', e)}
							class="h-7 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700"
						/>
					</label>
				</div>
			</section>

			<!-- Size -->
			<section>
				<div class="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
					<Maximize2 class="h-3 w-3" />
					Size
				</div>
				<div class="grid grid-cols-2 gap-2">
					<label class="flex flex-col gap-1">
						<span class="text-[10px] text-zinc-500">W</span>
						<input
							type="number"
							value={Math.round(element.width)}
							onchange={(e) => handleNumericInput('width', e)}
							class="h-7 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700"
						/>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-[10px] text-zinc-500">H</span>
						<input
							type="number"
							value={Math.round(element.height)}
							onchange={(e) => handleNumericInput('height', e)}
							class="h-7 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700"
						/>
					</label>
				</div>
			</section>

			<!-- Rotation -->
			<section>
				<div class="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
					<RotateCw class="h-3 w-3" />
					Rotation
				</div>
				<label class="flex items-center gap-2">
					<input
						type="number"
						value={Math.round(element.rotation)}
						onchange={(e) => handleNumericInput('rotation', e)}
						class="h-7 w-20 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700"
					/>
					<span class="text-[10px] text-zinc-500">deg</span>
				</label>
			</section>

			<div class="border-t border-zinc-800"></div>

			<!-- Fill -->
			<section>
				<div class="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
					<Paintbrush class="h-3 w-3" />
					Fill
				</div>
				<div class="flex items-center gap-2">
					<input
						type="color"
						value={element.styles.backgroundColor ?? '#4f46e5'}
						oninput={(e) => handleStyleInput('backgroundColor', e)}
						class="h-7 w-7 cursor-pointer rounded border border-zinc-800 bg-transparent p-0.5"
					/>
					<input
						type="text"
						value={element.styles.backgroundColor ?? '#4f46e5'}
						onchange={(e) => handleStyleInput('backgroundColor', e)}
						class="h-7 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs font-mono text-zinc-200 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700"
					/>
				</div>
			</section>

			<!-- Border Radius -->
			<section>
				<div class="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
					<Circle class="h-3 w-3" />
					Corner Radius
				</div>
				<div class="flex items-center gap-2">
					<input
						type="range"
						min="0"
						max="100"
						value={element.styles.borderRadius ?? 0}
						oninput={(e) => handleStyleInput('borderRadius', e)}
						class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-blue-500"
					/>
					<span class="min-w-[32px] text-right text-xs text-zinc-400">
						{element.styles.borderRadius ?? 0}
					</span>
				</div>
			</section>

			<!-- Opacity -->
			<section>
				<div class="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
					<SlidersHorizontal class="h-3 w-3" />
					Opacity
				</div>
				<div class="flex items-center gap-2">
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={element.styles.opacity ?? 1}
						oninput={(e) => handleStyleInput('opacity', e)}
						class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-blue-500"
					/>
					<span class="min-w-[32px] text-right text-xs text-zinc-400">
						{Math.round((element.styles.opacity ?? 1) * 100)}%
					</span>
				</div>
			</section>

			<div class="border-t border-zinc-800"></div>

			<!-- Lock & Visibility toggles -->
			<section class="flex gap-2">
				<button
					onclick={toggleLock}
					class="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 hover:text-zinc-200 {element.locked ? 'text-amber-400 border-amber-500/30 bg-amber-400/5' : 'text-zinc-400 border-zinc-800 bg-zinc-900'}"
					title={element.locked ? 'Unlock' : 'Lock'}
				>
					{#if element.locked}
						<Lock class="h-3.5 w-3.5" />
						Locked
					{:else}
						<Unlock class="h-3.5 w-3.5" />
						Unlocked
					{/if}
				</button>

				<button
					onclick={toggleVisible}
					class="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
					class:text-zinc-600={!element.visible}
					title={element.visible ? 'Hide' : 'Show'}
				>
					{#if element.visible}
						<Eye class="h-3.5 w-3.5" />
						Visible
					{:else}
						<EyeOff class="h-3.5 w-3.5" />
						Hidden
					{/if}
				</button>
			</section>
		</div>
	{:else}
		<div class="flex flex-1 items-center justify-center p-4">
			<p class="text-center text-xs text-zinc-600">
				Select an element to view its properties
			</p>
		</div>
	{/if}
</div>

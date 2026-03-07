<!--
  LayerPanel.svelte — left sidebar showing all elements ordered by z_index.

  Uses Lucide icons for visibility, lock, delete actions.
  Hover reveals actions, click selects the element on canvas.
-->
<script lang="ts">
	import {
		Eye,
		EyeOff,
		Lock,
		Unlock,
		Trash2,
		ChevronUp,
		ChevronDown,
		Layers
	} from 'lucide-svelte';
	import { getElementsSorted, updateElement } from '$lib/stores/elements.svelte';
	import { getSelectedId, select } from '$lib/stores/selection.svelte';

	interface Props {
		onReorder?: (id: string, newIndex: number) => void;
		onDelete?: (id: string) => void;
		onToggleLock?: (id: string, locked: boolean) => void;
		onToggleVisible?: (id: string, visible: boolean) => void;
	}

	let { onReorder, onDelete, onToggleLock, onToggleVisible }: Props = $props();

	function handleClick(id: string) {
		select(id);
	}

	function handleMoveUp(id: string) {
		const sorted = getElementsSorted();
		const idx = sorted.findIndex((el) => el.id === id);
		if (idx < sorted.length - 1 && onReorder) {
			onReorder(id, sorted[idx + 1].z_index + 1);
		}
	}

	function handleMoveDown(id: string) {
		const sorted = getElementsSorted();
		const idx = sorted.findIndex((el) => el.id === id);
		if (idx > 0 && onReorder) {
			onReorder(id, sorted[idx - 1].z_index - 1);
		}
	}

	function handleToggleLock(id: string, currentLocked: boolean) {
		const newLocked = !currentLocked;
		updateElement(id, { locked: newLocked });
		onToggleLock?.(id, newLocked);
	}

	function handleToggleVisible(id: string, currentVisible: boolean) {
		const newVisible = !currentVisible;
		updateElement(id, { visible: newVisible });
		onToggleVisible?.(id, newVisible);
	}
</script>

<div class="flex h-full w-[220px] flex-col border-r border-zinc-800 bg-zinc-950">
	<!-- Panel header -->
	<div class="flex items-center gap-1.5 border-b border-zinc-800 px-3 py-2.5">
		<Layers class="h-3.5 w-3.5 text-zinc-500" />
		<span class="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Layers</span>
	</div>

	<!-- Layer list -->
	<div class="flex-1 overflow-y-auto p-1">
		{#each getElementsSorted().toReversed() as element (element.id)}
			{@const isActive = getSelectedId() === element.id}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors
					{isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300'}"
				onclick={() => handleClick(element.id)}
				onkeydown={(e) => { if (e.key === 'Enter') handleClick(element.id); }}
				role="button"
				tabindex="0"
			>
				<!-- Color swatch -->
				<span
					class="h-3 w-3 rounded-sm flex-shrink-0 ring-1 ring-white/10"
					style:background-color={element.styles.backgroundColor ?? '#4f46e5'}
					style:opacity={element.visible ? 1 : 0.3}
				></span>

				<!-- Name -->
				<span class="flex-1 truncate text-xs" class:opacity-40={!element.visible}>
					{element.name}
				</span>

				<!-- Actions (shown on hover) -->
				<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
					<!-- Visibility toggle -->
					<button
						onclick={(e) => { e.stopPropagation(); handleToggleVisible(element.id, element.visible); }}
						class="rounded p-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
						title={element.visible ? 'Hide' : 'Show'}
					>
						{#if element.visible}
							<Eye class="h-3 w-3" />
						{:else}
							<EyeOff class="h-3 w-3" />
						{/if}
					</button>

					<!-- Lock toggle -->
					<button
						onclick={(e) => { e.stopPropagation(); handleToggleLock(element.id, element.locked); }}
						class="rounded p-0.5 hover:bg-zinc-700 {element.locked ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}"
						title={element.locked ? 'Unlock' : 'Lock'}
					>
						{#if element.locked}
							<Lock class="h-3 w-3" />
						{:else}
							<Unlock class="h-3 w-3" />
						{/if}
					</button>

					<!-- Move up -->
					<button
						onclick={(e) => { e.stopPropagation(); handleMoveUp(element.id); }}
						class="rounded p-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
						title="Move up"
					>
						<ChevronUp class="h-3 w-3" />
					</button>

					<!-- Move down -->
					<button
						onclick={(e) => { e.stopPropagation(); handleMoveDown(element.id); }}
						class="rounded p-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
						title="Move down"
					>
						<ChevronDown class="h-3 w-3" />
					</button>

					<!-- Delete -->
					{#if onDelete}
						<button
							onclick={(e) => { e.stopPropagation(); onDelete(element.id); }}
							class="rounded p-0.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
							title="Delete"
						>
							<Trash2 class="h-3 w-3" />
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

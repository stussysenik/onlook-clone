/**
 * wasm-diff TypeScript wrapper — local field-level diff engine.
 *
 * Computes element deltas locally in WASM for instant preview,
 * before the API roundtrip to the Go diff engine completes.
 * Falls back to a simple JS diff when WASM isn't available.
 */

import { isModuleLoaded } from './loader';
import type { CanvasElement, ElementDelta } from '$lib/types/element';

let wasmDiff: typeof import('wasm-diff') | null = null;

async function getWasm(): Promise<typeof import('wasm-diff') | null> {
	if (wasmDiff) return wasmDiff;
	if (!isModuleLoaded('diff')) return null;
	try {
		wasmDiff = await import('wasm-diff');
		return wasmDiff;
	} catch {
		return null;
	}
}

// Eagerly try to load
getWasm();

/** Check if the WASM diff module is ready. */
export function isLoaded(): boolean {
	return wasmDiff !== null;
}

/** Fields tracked for diffs (same as Go engine). */
const TRACKED_FIELDS = [
	'x', 'y', 'width', 'height', 'rotation', 'z_index',
	'name', 'locked', 'visible', 'styles'
] as const;

/**
 * Compute a delta between two element snapshots.
 *
 * Returns null if there are no changes.
 */
export function computeDelta(
	prev: CanvasElement,
	curr: CanvasElement
): ElementDelta | null {
	if (wasmDiff) {
		const result = wasmDiff.compute_delta(JSON.stringify(prev), JSON.stringify(curr));
		if (result === 'null') return null;
		try {
			return JSON.parse(result);
		} catch {
			return null;
		}
	}

	// JS fallback
	const changes: Record<string, { from: unknown; to: unknown }> = {};

	for (const field of TRACKED_FIELDS) {
		const prevVal = prev[field];
		const currVal = curr[field];

		if (field === 'styles') {
			if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
				changes[field] = { from: prevVal, to: currVal };
			}
		} else if (prevVal !== currVal) {
			changes[field] = { from: prevVal, to: currVal };
		}
	}

	if (Object.keys(changes).length === 0) return null;
	return { id: curr.id, changes };
}

/**
 * Batch compute deltas for multiple element pairs.
 *
 * Returns only elements that actually changed.
 */
export function batchComputeDeltas(
	pairs: Array<{ prev: CanvasElement; curr: CanvasElement }>
): ElementDelta[] {
	if (wasmDiff) {
		const input = pairs.map((p) => ({
			prev: p.prev,
			curr: p.curr
		}));
		const result = wasmDiff.batch_compute_deltas(JSON.stringify(input));
		try {
			return JSON.parse(result);
		} catch {
			return [];
		}
	}

	// JS fallback
	return pairs
		.map((p) => computeDelta(p.prev, p.curr))
		.filter((d): d is ElementDelta => d !== null);
}

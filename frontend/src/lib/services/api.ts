/**
 * Rails API service — handles all REST communication with the Rails backend.
 *
 * Rails is the system of record: all mutations go through here,
 * then Rails notifies the Go diff engine, which pushes to Phoenix.
 */
import type { CanvasElement } from '$lib/types/element';

const API_BASE = 'http://localhost:3000/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		...options
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`API ${res.status}: ${body}`);
	}

	return res.json();
}

/** Fetch all elements for a canvas */
export async function fetchElements(canvasId: string = 'default'): Promise<CanvasElement[]> {
	return request<CanvasElement[]>(`/elements?canvas_id=${canvasId}`);
}

/** Create a new element */
export async function createElement(
	element: Partial<CanvasElement>
): Promise<CanvasElement> {
	return request<CanvasElement>('/elements', {
		method: 'POST',
		body: JSON.stringify({ element })
	});
}

/** Update an element (e.g., after drag-end) */
export async function updateElement(
	id: string,
	updates: Partial<CanvasElement>
): Promise<CanvasElement> {
	return request<CanvasElement>(`/elements/${id}`, {
		method: 'PATCH',
		body: JSON.stringify({ element: updates })
	});
}

/** Delete an element */
export async function deleteElement(id: string): Promise<void> {
	await request(`/elements/${id}`, { method: 'DELETE' });
}

/** Batch update multiple elements (e.g., reorder z-indices) */
export async function batchUpdateElements(
	updates: Array<{ id: string } & Partial<CanvasElement>>
): Promise<CanvasElement[]> {
	return request<CanvasElement[]>('/elements/batch_update', {
		method: 'PATCH',
		body: JSON.stringify({ elements: updates })
	});
}

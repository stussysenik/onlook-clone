/**
 * Core element type representing a visual object on the canvas.
 * Uses UUID primary keys to match Rails PostgreSQL schema.
 * `styles` is a flexible JSONB bag — extensible without migrations.
 */
export interface ElementStyles {
	backgroundColor?: string;
	borderRadius?: number;
	opacity?: number;
	borderWidth?: number;
	borderColor?: string;
}

export interface CanvasElement {
	id: string;
	canvas_id: string;
	name: string;
	element_type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	z_index: number;
	styles: ElementStyles;
	locked: boolean;
	visible: boolean;
	version: number;
	created_at?: string;
	updated_at?: string;
}

/** Delta from the Go diff engine — field-level change tracking */
export interface ElementDelta {
	id: string;
	changes: Record<string, { from: unknown; to: unknown }>;
}

/** Broadcast event payload from Phoenix WebSocket */
export interface BroadcastEvent {
	event: 'element:updated' | 'element:created' | 'element:deleted' | 'element:batch_updated';
	payload: ElementDelta | CanvasElement | { ids: string[] } | { elements: CanvasElement[] };
}

/**
 * Phoenix WebSocket service — connects to the Phoenix realtime server
 * for live broadcast of element changes across clients.
 *
 * Flow: Go diff engine → HTTP POST → Phoenix → WebSocket → this client
 *
 * Bug fix: Exponential backoff on reconnection (max 3 retries),
 * then stops until manual reconnect. Prevents console spam.
 */
import type { ElementDelta, CanvasElement } from '$lib/types/element';
import {
	applyRemoteDelta,
	addElement,
	removeElement,
	batchUpdateElements
} from '$lib/stores/elements.svelte';

let socket: any = null;
let channel: any = null;
let connected = $state(false);
let retryCount = 0;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export function isConnected(): boolean {
	return connected;
}

/**
 * Connect to Phoenix and join the canvas channel.
 * Safe to call multiple times — will no-op if already connected.
 * Uses exponential backoff: 1s, 2s, 4s, then gives up.
 */
export async function connectToCanvas(canvasId: string = 'default'): Promise<void> {
	if (connected) return;
	if (retryCount >= MAX_RETRIES) {
		console.info('[socket] Max retries reached, staying offline');
		return;
	}

	try {
		const { Socket } = await import('phoenix');

		socket = new Socket('ws://localhost:4000/socket', {
			params: { canvas_id: canvasId },
			// Disable automatic reconnect — we handle it ourselves
			reconnectAfterMs: () => {
				retryCount++;
				if (retryCount >= MAX_RETRIES) {
					console.info('[socket] Max retries reached, stopping reconnection');
					return null as unknown as number;
				}
				const delay = BASE_DELAY_MS * Math.pow(2, retryCount - 1);
				console.info(`[socket] Reconnecting in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
				return delay;
			}
		});

		socket.onError(() => {
			connected = false;
		});

		socket.onClose(() => {
			connected = false;
		});

		socket.connect();

		channel = socket.channel(`canvas:${canvasId}`, {});

		channel.on('element:updated', (payload: ElementDelta) => {
			applyRemoteDelta(payload);
		});

		channel.on('element:created', (payload: CanvasElement) => {
			addElement(payload);
		});

		channel.on('element:deleted', (payload: { id: string }) => {
			removeElement(payload.id);
		});

		channel.on('element:batch_updated', (payload: { elements: CanvasElement[] }) => {
			batchUpdateElements(payload.elements);
		});

		channel
			.join()
			.receive('ok', () => {
				connected = true;
				retryCount = 0;
				console.log(`[socket] Joined canvas:${canvasId}`);
			})
			.receive('error', (err: unknown) => {
				console.warn('[socket] Join failed:', err);
				connected = false;
			});
	} catch {
		// Phoenix not available
		connected = false;
		retryCount++;

		if (retryCount < MAX_RETRIES) {
			const delay = BASE_DELAY_MS * Math.pow(2, retryCount - 1);
			console.info(`[socket] Phoenix unavailable, retry in ${delay}ms (${retryCount}/${MAX_RETRIES})`);
			setTimeout(() => connectToCanvas(canvasId), delay);
		} else {
			console.info('[socket] Phoenix not available, running in offline mode');
		}
	}
}

/** Manual reconnect (resets retry counter) */
export function reconnect(canvasId: string = 'default'): void {
	disconnect();
	retryCount = 0;
	connectToCanvas(canvasId);
}

export function disconnect(): void {
	if (channel) channel.leave();
	if (socket) socket.disconnect();
	connected = false;
}

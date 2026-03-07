/**
 * Throttle a function to fire at most once per `ms` milliseconds.
 * Used for pointer-move events during drag (target: 60fps = 16ms).
 */
export function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
	let lastCall = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;

	return ((...args: unknown[]) => {
		const now = Date.now();
		const remaining = ms - (now - lastCall);

		if (remaining <= 0) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			lastCall = now;
			fn(...args);
		} else if (!timer) {
			timer = setTimeout(() => {
				lastCall = Date.now();
				timer = null;
				fn(...args);
			}, remaining);
		}
	}) as T;
}

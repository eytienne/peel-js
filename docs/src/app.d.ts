// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Tween } from "svelte/motion";

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	type TweenedOptions<T = any> = ConstructorParameters<typeof Tween<T>>[1];
}

export {};

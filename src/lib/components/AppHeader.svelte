<script lang="ts">
	import { getContext } from 'svelte';
	import type { AuthUser } from '$lib/types';

	interface AuthContext {
		user: AuthUser | null;
		logout: () => Promise<void>;
	}

	interface Props {
		backHref?: string;
		backLabel?: string;
		actions?: import('svelte').Snippet;
	}

	const { backHref, backLabel = 'Back', actions }: Props = $props();
	const auth = getContext<AuthContext>('auth');
</script>

<header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
	<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
		<div class="flex min-w-0 items-center gap-3">
			<a
				href="/app"
				class="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900"
			>
				<span
					class="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs text-white"
					>P</span
				>
				PackPal
			</a>
			{#if backHref}
				<a
					href={backHref}
					class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m15 18-6-6 6-6" />
					</svg>
					{backLabel}
				</a>
			{/if}
		</div>

		<div class="flex flex-wrap items-center justify-end gap-2">
			{#if actions}
				{@render actions()}
			{/if}
			<a href="/app/profile" class="text-sm text-slate-600 transition-colors hover:text-brand-600">
				{auth.user?.displayName}
			</a>
			<button
				onclick={auth.logout}
				class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
			>
				Sign out
			</button>
		</div>
	</div>
</header>

<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} - PackPal</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white font-sans"
>
	<div class="px-6 text-center">
		<div
			class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-4xl"
		>
			{#if page.status === 404}
				&#x1F9ED;
			{:else}
				&#x26A0;&#xFE0F;
			{/if}
		</div>
		<h1 class="text-6xl font-bold text-brand-600">{page.status}</h1>
		<p class="mt-3 text-lg text-slate-600">
			{#if page.status === 404}
				This page doesn't exist. Maybe it went on a trip?
			{:else}
				{page.error?.message ?? 'Something went wrong'}
			{/if}
		</p>
		<div class="mt-8 flex items-center justify-center gap-3">
			<a
				href="/"
				class="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
			>
				Home
			</a>
			<a
				href="/app"
				class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700"
			>
				Go to Dashboard
			</a>
		</div>
		<p class="mt-12 text-xs text-slate-400">PackPal &middot; Pack perfectly, travel confidently.</p>
	</div>
</div>

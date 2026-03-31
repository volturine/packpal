<script lang="ts">
	import type { PackingPreset } from '$lib/types';

	interface Props {
		presets: PackingPreset[];
		onsave: (name: string) => Promise<string | null>;
		onapply: (preset: PackingPreset) => void;
		ondelete: (presetId: string) => void;
	}

	const { presets, onsave, onapply, ondelete }: Props = $props();

	let presetName = $state('');
	let error = $state('');
	let saving = $state(false);
	let showAll = $state(false);

	const displayedPresets = $derived(showAll ? presets : presets.slice(0, 5));

	async function savePreset() {
		if (!presetName.trim() || saving) return;
		saving = true;
		error = '';
		const result = await onsave(presetName.trim());
		if (result) {
			error = result;
		} else {
			presetName = '';
		}
		saving = false;
	}

	function confirmDelete(preset: PackingPreset) {
		if (!confirm(`Delete preset "${preset.name}"?`)) return;
		ondelete(preset.id);
	}
</script>

<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
	<h2 class="text-base font-semibold text-slate-900">Packing Presets</h2>
	<p class="mt-1 text-sm text-slate-500">
		Save this list as a reusable preset or apply one of your past presets.
	</p>
	<div class="mt-4 flex gap-2">
		<input
			type="text"
			bind:value={presetName}
			placeholder="Preset name"
			class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<button
			onclick={savePreset}
			disabled={!presetName.trim() || saving}
			class="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
		>
			Save
		</button>
	</div>
	{#if error}
		<p class="mt-2 text-sm text-red-600">{error}</p>
	{/if}
	<ul class="mt-4 space-y-2">
		{#if presets.length === 0}
			<li class="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">No presets yet.</li>
		{:else}
			{#each displayedPresets as preset (preset.id)}
				<li class="group rounded-lg bg-slate-50 px-3 py-3">
					<div class="flex items-center justify-between gap-2">
						<div>
							<div class="text-sm font-medium text-slate-800">{preset.name}</div>
							<div class="text-xs text-slate-500">{preset.items.length} items</div>
						</div>
						<div class="flex items-center gap-1">
							<button
								onclick={() => onapply(preset)}
								class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
							>
								Apply
							</button>
							<button
								onclick={() => confirmDelete(preset)}
								class="rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50"
							>
								Delete
							</button>
						</div>
					</div>
				</li>
			{/each}
			{#if presets.length > 5}
				<li>
					<button
						onclick={() => (showAll = !showAll)}
						class="w-full rounded-lg px-3 py-2 text-center text-xs font-medium text-brand-600 hover:bg-brand-50"
					>
						{showAll ? 'Show fewer' : `Show all ${presets.length} presets`}
					</button>
				</li>
			{/if}
		{/if}
	</ul>
</div>

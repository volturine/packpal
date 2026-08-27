<script lang="ts">
	import { CATEGORIES } from '$lib/data/packing-templates';
	import type { PackingItemPriority } from '$lib/types';

	interface Props {
		onadd: (item: {
			name: string;
			category: string;
			quantity: number;
			notes: string | undefined;
			priority: PackingItemPriority;
		}) => void;
		onclose: () => void;
	}

	const { onadd, onclose }: Props = $props();

	let name = $state('');
	let category = $state('Clothing');
	let quantity = $state(1);
	let priority = $state<PackingItemPriority>('normal');
	let notes = $state('');
	let quantityError = $state('');

	function handleAdd() {
		if (!name.trim()) return;
		if (!Number.isInteger(quantity) || quantity < 1) {
			quantityError = 'Quantity must be at least 1';
			return;
		}

		quantityError = '';
		onadd({
			name: name.trim(),
			category,
			quantity,
			notes: notes.trim() || undefined,
			priority
		});
		name = '';
		category = 'Clothing';
		quantity = 1;
		priority = 'normal';
		notes = '';
		onclose();
	}
</script>

<div class="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-4">
	<div class="grid gap-3 md:grid-cols-[2fr_1fr_80px_1fr]">
		<input
			id="new-item-name"
			type="text"
			bind:value={name}
			placeholder="Item name"
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<select
			id="new-item-category"
			bind:value={category}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
		>
			{#each CATEGORIES as cat (cat)}
				<option value={cat}>{cat}</option>
			{/each}
		</select>
		<input
			id="new-item-qty"
			type="number"
			min="1"
			bind:value={quantity}
			oninput={() => (quantityError = '')}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
		/>
		<select
			bind:value={priority}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
		>
			<option value="must">Must pack</option>
			<option value="normal">Normal</option>
			<option value="optional">Optional</option>
		</select>
	</div>
	{#if quantityError}
		<p class="mt-2 text-sm text-red-600">{quantityError}</p>
	{/if}
	<div class="mt-3 flex gap-3">
		<input
			type="text"
			bind:value={notes}
			placeholder="Optional note"
			class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<button
			onclick={handleAdd}
			disabled={!name.trim()}
			class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
		>
			Add
		</button>
	</div>
</div>

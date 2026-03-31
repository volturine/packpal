<script lang="ts">
	import { CATEGORIES } from '$lib/data/packing-templates';
	import type { PackingItem, PackingItemPriority } from '$lib/types';
	import { isCriticalItem } from '$lib/packing-insights';

	interface Props {
		item: PackingItem;
		editing: boolean;
		ontoggle: (id: string) => void;
		onedit: (item: PackingItem) => void;
		onremove: (id: string) => void;
		onsaveedit: (data: {
			id: string;
			name: string;
			category: string;
			quantity: number;
			notes: string | null;
			priority: PackingItemPriority;
		}) => void;
		oncanceledit: () => void;
	}

	const { item, editing, ontoggle, onedit, onremove, onsaveedit, oncanceledit }: Props = $props();

	let editName = $state('');
	let editCategory = $state('Clothing');
	let editQuantity = $state(1);
	let editNotes = $state('');
	let editPriority = $state<PackingItemPriority>('normal');
	let editError = $state('');

	function priorityBadgeClasses(priority: PackingItemPriority): string {
		if (priority === 'must') return 'bg-red-50 text-red-700';
		if (priority === 'optional') return 'bg-slate-100 text-slate-500';
		return 'bg-blue-50 text-blue-700';
	}

	function startEdit() {
		editName = item.name;
		editCategory = item.category;
		editQuantity = item.quantity;
		editNotes = item.notes ?? '';
		editPriority = item.priority;
		onedit(item);
	}

	function saveEdit() {
		if (!editName.trim()) return;
		if (!Number.isInteger(editQuantity) || editQuantity < 1) {
			editError = 'Quantity must be at least 1';
			return;
		}

		editError = '';
		onsaveedit({
			id: item.id,
			name: editName.trim(),
			category: editCategory,
			quantity: editQuantity,
			notes: editNotes.trim() || null,
			priority: editPriority
		});
	}

	$effect(() => {
		if (editing) {
			editName = item.name;
			editCategory = item.category;
			editQuantity = item.quantity;
			editNotes = item.notes ?? '';
			editPriority = item.priority;
			editError = '';
		}
	});
</script>

<li class="group flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
	{#if editing}
		<div class="flex-1">
			<div class="grid gap-2 md:grid-cols-[2fr_1fr_80px_1fr_1fr_auto_auto]">
				<input
					type="text"
					bind:value={editName}
					class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
				/>
				<select
					bind:value={editCategory}
					class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
				>
					{#each CATEGORIES as currentCategory (currentCategory)}
						<option value={currentCategory}>{currentCategory}</option>
					{/each}
				</select>
				<input
					type="number"
					min="1"
					bind:value={editQuantity}
					oninput={() => (editError = '')}
					class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
				/>
				<select
					bind:value={editPriority}
					class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
				>
					<option value="must">Must</option>
					<option value="normal">Normal</option>
					<option value="optional">Optional</option>
				</select>
				<input
					type="text"
					bind:value={editNotes}
					placeholder="Optional note"
					class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
				/>
				<button
					onclick={saveEdit}
					class="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700">Save</button
				>
				<button
					onclick={oncanceledit}
					class="rounded bg-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-300"
					>Cancel</button
				>
			</div>
			{#if editError}
				<p class="mt-2 text-sm text-red-600">{editError}</p>
			{/if}
		</div>
	{:else}
		<button
			onclick={() => ontoggle(item.id)}
			class="flex h-5 w-5 shrink-0 items-center justify-center rounded border {item.packed
				? 'border-emerald-500 bg-emerald-500'
				: 'border-slate-300 hover:border-brand-500'}"
		>
			{#if item.packed}
				<svg class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
						clip-rule="evenodd"
					/>
				</svg>
			{/if}
		</button>
		<div class="flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-sm {item.packed ? 'text-slate-400 line-through' : 'text-slate-800'}"
					>{item.name}</span
				>
				<span
					class="rounded-full px-1.5 py-0.5 text-[10px] font-medium {priorityBadgeClasses(
						item.priority
					)}">{item.priority}</span
				>
				{#if isCriticalItem(item)}
					<span class="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
						>Critical</span
					>
				{/if}
				{#if item.isCustom}
					<span
						class="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600"
						>Custom</span
					>
				{/if}
			</div>
			{#if item.notes}
				<div class="mt-0.5 text-xs text-slate-500">{item.notes}</div>
			{/if}
		</div>
		{#if item.quantity > 1}
			<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
				>x{item.quantity}</span
			>
		{/if}
		<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
			<button
				onclick={startEdit}
				class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
				aria-label="Edit item">Edit</button
			>
			<button
				onclick={() => onremove(item.id)}
				class="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
				aria-label="Remove item">Remove</button
			>
		</div>
	{/if}
</li>

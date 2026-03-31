<script lang="ts">
	import { goto } from '$app/navigation';
	import { CATEGORIES } from '$lib/data/packing-templates';
	import type { Climate } from '$lib/data/packing-templates';
	import {
		formatActivityNames,
		getSeasonHint,
		getTripInsightSummary,
		getPrioritySortValue,
		isCriticalItem
	} from '$lib/packing-insights';
	import { formatDate, daysUntil, reminderClasses } from '$lib/format';
	import type {
		PackingItem,
		PackingPreset,
		PackingItemPriority,
		Trip,
		TripCollaborator
	} from '$lib/types';

	import Toast from '$lib/components/Toast.svelte';
	import TripEditModal from '$lib/components/TripEditModal.svelte';
	import PackingItemRow from '$lib/components/PackingItemRow.svelte';
	import AddItemForm from '$lib/components/AddItemForm.svelte';
	import CollaboratorsPanel from '$lib/components/CollaboratorsPanel.svelte';
	import PresetsPanel from '$lib/components/PresetsPanel.svelte';

	const { data } = $props();
	const tripId = $derived(data.tripId);

	let trip = $state<Trip | null>(null);
	let items = $state<PackingItem[]>([]);
	let presets = $state<PackingPreset[]>([]);
	let collaborators = $state<TripCollaborator[]>([]);
	let loadError = $state(false);
	let loading = $state(true);
	let searchQuery = $state('');
	let filterCategory = $state('all');
	let filterStatus = $state<'all' | 'packed' | 'unpacked' | 'critical'>('all');
	let dayOfTravelMode = $state(false);
	let showAddItem = $state(false);
	let editingItemId = $state<string | null>(null);
	let editingTrip = $state(false);

	let toast = $state<{
		message: string;
		undoLabel?: string;
		action?: () => Promise<void> | void;
	} | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;

	const categories = $derived.by(() => {
		const seen: string[] = [];
		for (const item of items) {
			if (!seen.includes(item.category)) seen.push(item.category);
		}
		return seen.sort(
			(a, b) =>
				(CATEGORIES.indexOf(a as (typeof CATEGORIES)[number]) ?? 99) -
				(CATEGORIES.indexOf(b as (typeof CATEGORIES)[number]) ?? 99)
		);
	});

	const tripInsights = $derived(trip ? getTripInsightSummary(trip, items) : null);

	const visibleItems = $derived.by(() => {
		let filtered = items;
		if (filterCategory !== 'all')
			filtered = filtered.filter((item) => item.category === filterCategory);
		if (filterStatus === 'packed') filtered = filtered.filter((item) => item.packed);
		if (filterStatus === 'unpacked') filtered = filtered.filter((item) => !item.packed);
		if (filterStatus === 'critical')
			filtered = filtered.filter((item) => !item.packed && isCriticalItem(item));
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((item) => item.name.toLowerCase().includes(query));
		}
		return [...filtered].sort((a, b) => {
			if (dayOfTravelMode) {
				const criticalDiff = Number(isCriticalItem(b)) - Number(isCriticalItem(a));
				if (criticalDiff !== 0) return criticalDiff;
				if (a.packed !== b.packed) return Number(a.packed) - Number(b.packed);
			}
			const priorityDiff = getPrioritySortValue(a.priority) - getPrioritySortValue(b.priority);
			if (priorityDiff !== 0) return priorityDiff;
			if (a.packed !== b.packed) return Number(a.packed) - Number(b.packed);
			return a.name.localeCompare(b.name);
		});
	});

	const groupedItems = $derived.by(() => {
		const entries: [string, PackingItem[]][] = [];
		for (const item of visibleItems) {
			let entry = entries.find(([category]) => category === item.category);
			if (!entry) {
				entry = [item.category, []];
				entries.push(entry);
			}
			entry[1].push(item);
		}
		return entries;
	});

	const totalItems = $derived(items.length);
	const packedItems = $derived(items.filter((item) => item.packed).length);
	const progressPercent = $derived(
		totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0
	);

	function showToast(message: string, action?: () => Promise<void> | void, undoLabel = 'Undo') {
		toast = { message, action, undoLabel };
		if (toastTimeout) clearTimeout(toastTimeout);
		toastTimeout = setTimeout(() => {
			toast = null;
		}, 5000);
	}

	async function loadData() {
		loading = true;
		loadError = false;
		try {
			const [tripRes, itemsRes, presetsRes] = await Promise.all([
				fetch(`/api/trips/${tripId}`),
				fetch(`/api/packing-items?tripId=${tripId}`),
				fetch('/api/packing-presets')
			]);
			if (!tripRes.ok) {
				loadError = true;
				return;
			}
			const loadedTrip = (await tripRes.json()) as Trip;
			trip = loadedTrip;
			collaborators = loadedTrip.collaborators ?? [];
			items = await itemsRes.json();
			presets = presetsRes.ok ? await presetsRes.json() : [];
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	async function toggleItem(itemId: string) {
		const res = await fetch('/api/packing-items', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'toggle', id: itemId })
		});
		if (!res.ok) return;
		items = items.map((item) => (item.id === itemId ? { ...item, packed: !item.packed } : item));
	}

	async function toggleVisibleItems(packed: boolean) {
		const filteredItemIds = visibleItems.map((item) => item.id);
		const previousItems = items;
		const res = await fetch('/api/packing-items', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'toggleTrip', tripId, packed, filteredItemIds })
		});
		if (!res.ok) return;
		items = items.map((item) => (filteredItemIds.includes(item.id) ? { ...item, packed } : item));
		showToast(
			`${packed ? 'Packed' : 'Unpacked'} ${filteredItemIds.length} visible item${filteredItemIds.length === 1 ? '' : 's'}.`,
			async () => {
				items = previousItems;
				await fetch('/api/packing-items', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'toggleTrip', tripId, packed: !packed, filteredItemIds })
				});
			}
		);
	}

	async function toggleCategory(category: string, packed: boolean) {
		const categoryItems = visibleItems
			.filter((item) => item.category === category)
			.map((item) => item.id);
		const res = await fetch('/api/packing-items', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'toggleAll',
				tripId,
				category,
				packed,
				filteredItemIds: categoryItems
			})
		});
		if (!res.ok) return;
		items = items.map((item) => (categoryItems.includes(item.id) ? { ...item, packed } : item));
	}

	async function addItem(newItem: {
		name: string;
		category: string;
		quantity: number;
		notes: string | undefined;
		priority: PackingItemPriority;
	}) {
		const res = await fetch('/api/packing-items', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tripId, item: newItem })
		});
		if (!res.ok) return;
		const { id } = await res.json();
		items = [
			...items,
			{
				id,
				tripId,
				userId: '',
				name: newItem.name,
				category: newItem.category,
				quantity: newItem.quantity,
				packed: false,
				isCustom: true,
				notes: newItem.notes ?? null,
				priority: newItem.priority
			}
		];
	}

	async function removeItem(itemId: string) {
		const item = items.find((i) => i.id === itemId);
		if (!item) return;
		const res = await fetch('/api/packing-items', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: itemId })
		});
		if (!res.ok) return;
		items = items.filter((i) => i.id !== itemId);
		showToast(`Removed ${item.name}.`, async () => {
			const restoreRes = await fetch('/api/packing-items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tripId,
					item: {
						name: item.name,
						category: item.category,
						quantity: item.quantity,
						notes: item.notes ?? undefined,
						priority: item.priority
					}
				})
			});
			if (!restoreRes.ok) return;
			const { id } = await restoreRes.json();
			items = [...items, { ...item, id }];
		});
	}

	async function saveEdit(data: {
		id: string;
		name: string;
		category: string;
		quantity: number;
		notes: string | null;
		priority: PackingItemPriority;
	}) {
		const res = await fetch('/api/packing-items', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'update', ...data })
		});
		if (!res.ok) return;
		items = items.map((item) =>
			item.id === data.id
				? {
						...item,
						name: data.name,
						category: data.category,
						quantity: data.quantity,
						notes: data.notes,
						priority: data.priority
					}
				: item
		);
		editingItemId = null;
	}

	async function saveTripDetails(data: {
		name: string;
		destination: string;
		country: string | null;
		startDate: number;
		endDate: number;
		activities: string[];
		climate: Climate;
		travelers: number;
		notes: string | null;
	}) {
		const res = await fetch('/api/trips', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: tripId, ...data })
		});
		if (!res.ok) {
			const errData = await res.json();
			throw new Error(errData.error ?? 'Failed to update trip');
		}
		await loadData();
		editingTrip = false;
	}

	async function deleteTrip() {
		if (!confirm('Delete this trip and all its packing items?')) return;
		await fetch('/api/trips', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: tripId })
		});
		await goto('/app');
	}

	async function addCollaborator(username: string): Promise<string | null> {
		const res = await fetch('/api/trips', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'addCollaborator', tripId, username })
		});
		if (!res.ok) {
			const data = await res.json();
			return data.error ?? 'Failed to add collaborator';
		}
		await loadData();
		return null;
	}

	async function removeCollaborator(userId: string) {
		const res = await fetch('/api/trips', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: tripId, collaboratorUserId: userId })
		});
		if (!res.ok) return;
		collaborators = collaborators.filter((c) => c.userId !== userId);
	}

	async function savePreset(name: string): Promise<string | null> {
		const res = await fetch('/api/packing-presets', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'saveFromTrip', tripId, name })
		});
		if (!res.ok) {
			const data = await res.json();
			return data.error ?? 'Failed to save preset';
		}
		presets = await (await fetch('/api/packing-presets')).json();
		return null;
	}

	async function applyPreset(preset: PackingPreset) {
		const res = await fetch('/api/packing-items', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				tripId,
				items: preset.items.map((item) => ({
					name: item.name,
					category: item.category,
					quantity: item.quantity,
					isCustom: true,
					notes: item.notes ?? undefined,
					priority: item.priority
				}))
			})
		});
		if (!res.ok) return;
		await fetch('/api/packing-presets', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: preset.id, action: 'markUsed' })
		});
		await loadData();
		showToast(`Applied preset ${preset.name}.`);
	}

	async function deletePreset(presetId: string) {
		const res = await fetch('/api/packing-presets', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: presetId })
		});
		if (!res.ok) return;
		presets = presets.filter((p) => p.id !== presetId);
	}

	$effect(() => {
		loadData();
	});
</script>

<div class="min-h-screen bg-surface font-sans text-slate-900">
	<header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
			<a href="/app" class="flex items-center gap-2 text-lg font-bold tracking-tight">
				<span
					class="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs text-white"
					>P</span
				>
				PackPal
			</a>
			<div class="flex items-center gap-2">
				<a
					href="/app/trips/{tripId}/chat"
					class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				>
					AI Assistant
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-8">
		{#if loadError}
			<div class="py-20 text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl"
				>
					&#x26A0;
				</div>
				<h2 class="text-lg font-semibold text-slate-900">Trip not found</h2>
				<p class="mt-2 text-sm text-slate-500">
					This trip doesn't exist or you don't have access to it.
				</p>
				<a
					href="/app"
					class="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
				>
					Back to dashboard
				</a>
			</div>
		{:else if loading || !trip}
			<div class="flex items-center justify-center py-20">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
				></div>
			</div>
		{:else}
			<div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
				<!-- Main content -->
				<section>
					<div class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<!-- Trip header info -->
						<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
							<div>
								<a
									href="/app"
									class="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
								>
									<svg
										class="h-4 w-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg
									>
									Back to trips
								</a>
								<div class="flex flex-wrap items-center gap-2">
									<h1 class="text-2xl font-bold">{trip.name}</h1>
									{#if trip.isShared}
										<span
											class="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
											>Shared trip</span
										>
									{/if}
								</div>
								<p class="mt-1 text-sm text-slate-500">
									{trip.destination}{trip.country ? `, ${trip.country}` : ''}
								</p>
								<div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
									<span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
									<span class="font-medium text-brand-600">{daysUntil(trip.startDate)}</span>
									<span>{trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}</span>
									<span>Owner: {trip.ownerDisplayName}</span>
								</div>
								<div class="mt-2 text-sm text-slate-500">
									Climate: <span class="font-medium text-slate-700 capitalize">{trip.climate}</span>
								</div>
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each formatActivityNames(trip.activities) as activity (activity)}
										<span
											class="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
											>{activity}</span
										>
									{/each}
								</div>
								{#if trip.notes}
									<p class="mt-3 max-w-2xl text-sm text-slate-500">{trip.notes}</p>
								{/if}
							</div>
							<div class="flex flex-wrap gap-2">
								<button
									onclick={() => (editingTrip = true)}
									class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
									>Edit Details</button
								>
								{#if !trip.isShared}
									<button
										onclick={deleteTrip}
										class="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
										>Delete Trip</button
									>
								{/if}
							</div>
						</div>

						<!-- Progress + day-of-travel -->
						<div class="mt-5 grid gap-3 md:grid-cols-2">
							<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-medium text-slate-700"
										>{packedItems} of {totalItems} items packed</span
									>
									<span class="text-sm font-bold text-brand-600">{progressPercent}%</span>
								</div>
								<div class="h-3 overflow-hidden rounded-full bg-slate-200">
									<div
										class="h-full rounded-full bg-brand-500 transition-all"
										style="width: {progressPercent}%"
									></div>
								</div>
								{#if progressPercent === 100}
									<p class="mt-2 text-sm font-medium text-emerald-600">
										All packed! You're ready to go!
									</p>
								{/if}
							</div>
							<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<div class="text-sm font-semibold text-slate-800">Day-of-travel focus</div>
								<p class="mt-1 text-sm text-slate-500">
									Surface critical, high-priority, and still-unpacked items first.
								</p>
								<button
									onclick={() => (dayOfTravelMode = !dayOfTravelMode)}
									class="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
								>
									{dayOfTravelMode ? 'Disable day-of-travel mode' : 'Enable day-of-travel mode'}
								</button>
							</div>
						</div>

						<!-- Reminder -->
						{#if trip.reminder}
							<div
								class="mt-4 rounded-xl border px-4 py-3 text-sm font-medium {reminderClasses(
									trip.reminder.tone
								)}"
							>
								{trip.reminder.label}
							</div>
						{/if}

						<!-- Warnings -->
						{#if trip.contradictions?.length || getSeasonHint(trip.startDate, trip.destination, trip.climate)}
							<div
								class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
							>
								<div class="font-semibold">Packing warnings</div>
								<ul class="mt-2 space-y-1">
									{#each trip.contradictions ?? [] as contradiction (contradiction.message)}
										<li>{contradiction.message}</li>
									{/each}
									{#if getSeasonHint(trip.startDate, trip.destination, trip.climate)}
										<li>
											{getSeasonHint(trip.startDate, trip.destination, trip.climate)}
										</li>
									{/if}
								</ul>
							</div>
						{/if}

						<!-- Packing list -->
						<div class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
								<div class="flex flex-1 gap-2">
									<input
										type="text"
										bind:value={searchQuery}
										placeholder="Search items..."
										class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
									/>
									<select
										bind:value={filterStatus}
										class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
									>
										<option value="all">All</option>
										<option value="unpacked">Unpacked</option>
										<option value="packed">Packed</option>
										<option value="critical">Critical</option>
									</select>
								</div>
								<div class="flex flex-wrap gap-2">
									<button
										onclick={() => toggleVisibleItems(true)}
										class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
										>Pack Visible</button
									>
									<button
										onclick={() => toggleVisibleItems(false)}
										class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
										>Unpack Visible</button
									>
									<button
										onclick={() => (showAddItem = !showAddItem)}
										class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
										>+ Add Item</button
									>
								</div>
							</div>

							{#if showAddItem}
								<AddItemForm onadd={addItem} onclose={() => (showAddItem = false)} />
							{/if}

							{#if categories.length > 1}
								<div class="mb-4 flex flex-wrap gap-1.5">
									<button
										onclick={() => (filterCategory = 'all')}
										class="rounded-lg px-3 py-1.5 text-xs font-medium {filterCategory === 'all'
											? 'bg-brand-600 text-white'
											: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
										>All ({totalItems})</button
									>
									{#each categories as category (category)}
										<button
											onclick={() => (filterCategory = category)}
											class="rounded-lg px-3 py-1.5 text-xs font-medium {filterCategory === category
												? 'bg-brand-600 text-white'
												: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">{category}</button
										>
									{/each}
								</div>
							{/if}

							{#if visibleItems.length === 0}
								<div class="py-12 text-center text-sm text-slate-500">No items in this view.</div>
							{:else}
								<div class="space-y-4">
									{#each groupedItems as [category, categoryItems] (category)}
										{@const packedInCategory = categoryItems.filter((item) => item.packed).length}
										{@const allPacked = packedInCategory === categoryItems.length}
										<div class="rounded-xl border border-slate-200 bg-slate-50">
											<div
												class="flex items-center justify-between border-b border-slate-200 px-4 py-3"
											>
												<div class="flex items-center gap-2">
													<h2 class="text-sm font-semibold text-slate-800">
														{category}
													</h2>
													<span class="text-xs text-slate-400"
														>{packedInCategory}/{categoryItems.length}</span
													>
												</div>
												<button
													onclick={() => toggleCategory(category, !allPacked)}
													class="text-xs font-medium text-brand-600 hover:text-brand-700"
												>
													{allPacked ? 'Unpack visible' : 'Pack visible'}
												</button>
											</div>
											<ul>
												{#each categoryItems as item (item.id)}
													<PackingItemRow
														{item}
														editing={editingItemId === item.id}
														ontoggle={toggleItem}
														onedit={() => (editingItemId = item.id)}
														onremove={removeItem}
														onsaveedit={saveEdit}
														oncanceledit={() => (editingItemId = null)}
													/>
												{/each}
											</ul>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</section>

				<!-- Sidebar -->
				<aside class="space-y-6">
					<CollaboratorsPanel
						{trip}
						{collaborators}
						onadd={addCollaborator}
						onremove={removeCollaborator}
					/>

					<PresetsPanel
						{presets}
						onsave={savePreset}
						onapply={applyPreset}
						ondelete={deletePreset}
					/>

					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h2 class="text-base font-semibold text-slate-900">Trip Focus</h2>
						<ul class="mt-3 space-y-2 text-sm text-slate-600">
							<li>
								{tripInsights?.criticalUnpackedCount ?? 0} critical item{tripInsights?.criticalUnpackedCount ===
								1
									? ''
									: 's'} still unpacked
							</li>
							<li>
								{tripInsights?.priorityUnpackedCount ?? 0} must-pack item{tripInsights?.priorityUnpackedCount ===
								1
									? ''
									: 's'} remaining
							</li>
							<li>
								{dayOfTravelMode ? 'Day-of-travel sorting enabled' : 'Standard packing view'}
							</li>
						</ul>
					</div>
				</aside>
			</div>
		{/if}
	</main>

	<Toast {toast} />

	{#if trip}
		<TripEditModal
			open={editingTrip}
			{trip}
			onclose={() => (editingTrip = false)}
			onsave={saveTripDetails}
		/>
	{/if}
</div>

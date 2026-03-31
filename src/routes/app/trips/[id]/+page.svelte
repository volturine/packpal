<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		ACTIVITIES,
		ACTIVITY_GROUPS,
		CATEGORIES,
		CLIMATE_OPTIONS,
		type Climate
	} from '$lib/data/packing-templates';
	import {
		formatActivityNames,
		getSeasonHint,
		getTripInsightSummary,
		getPrioritySortValue,
		isCriticalItem
	} from '$lib/packing-insights';
	import type {
		PackingItem,
		PackingPreset,
		PackingItemPriority,
		ReminderSummary,
		Trip,
		TripCollaborator
	} from '$lib/types';

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
	let newItemName = $state('');
	let newItemCategory = $state('Clothing');
	let newItemQuantity = $state(1);
	let newItemPriority = $state<PackingItemPriority>('normal');
	let newItemNotes = $state('');

	let editingItemId = $state<string | null>(null);
	let editName = $state('');
	let editCategory = $state('Clothing');
	let editQuantity = $state(1);
	let editNotes = $state('');
	let editPriority = $state<PackingItemPriority>('normal');

	let editingTrip = $state(false);
	let tripSubmitting = $state(false);
	let tripError = $state('');
	let tripName = $state('');
	let tripDestination = $state('');
	let tripCountry = $state('');
	let tripStartDate = $state('');
	let tripEndDate = $state('');
	let tripTravelers = $state(1);
	let tripNotes = $state('');
	let tripClimate = $state<Climate>('temperate');
	let tripActivities = $state<string[]>([]);

	let collaboratorUsername = $state('');
	let collaboratorError = $state('');
	let collaboratorSubmitting = $state(false);
	let presetName = $state('');
	let presetError = $state('');
	let savingPreset = $state(false);
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
	const canSaveTripDetails = $derived(
		tripName.trim() !== '' &&
			tripDestination.trim() !== '' &&
			tripStartDate !== '' &&
			tripEndDate !== '' &&
			tripTravelers > 0 &&
			tripActivities.length > 0 &&
			new Date(tripEndDate) >= new Date(tripStartDate)
	);

	function formatDate(ts: number) {
		return new Date(ts).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function daysUntil(ts: number) {
		const diff = ts - Date.now();
		const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
		if (days < 0) return `${Math.abs(days)} days ago`;
		if (days === 0) return 'Today!';
		if (days === 1) return 'Tomorrow!';
		return `${days} days to go`;
	}

	function toDateInputValue(ts: number) {
		return new Date(ts).toISOString().slice(0, 10);
	}

	function syncTripForm(currentTrip: Trip) {
		tripName = currentTrip.name;
		tripDestination = currentTrip.destination;
		tripCountry = currentTrip.country ?? '';
		tripStartDate = toDateInputValue(currentTrip.startDate);
		tripEndDate = toDateInputValue(currentTrip.endDate);
		tripTravelers = currentTrip.travelers;
		tripNotes = currentTrip.notes ?? '';
		tripClimate = currentTrip.climate;
		tripActivities = [...currentTrip.activities];
	}

	function resetAddItemForm() {
		newItemName = '';
		newItemCategory = 'Clothing';
		newItemQuantity = 1;
		newItemPriority = 'normal';
		newItemNotes = '';
	}

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
			syncTripForm(loadedTrip);
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

	async function addItem() {
		if (!newItemName.trim()) return;
		const res = await fetch('/api/packing-items', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				tripId,
				item: {
					name: newItemName.trim(),
					category: newItemCategory,
					quantity: newItemQuantity,
					notes: newItemNotes.trim() || undefined,
					priority: newItemPriority
				}
			})
		});
		if (!res.ok) return;
		const { id } = await res.json();
		items = [
			...items,
			{
				id,
				tripId,
				userId: '',
				name: newItemName.trim(),
				category: newItemCategory,
				quantity: newItemQuantity,
				packed: false,
				isCustom: true,
				notes: newItemNotes.trim() || null,
				priority: newItemPriority
			}
		];
		resetAddItemForm();
		showAddItem = false;
	}

	async function removeItem(itemId: string) {
		const item = items.find((currentItem) => currentItem.id === itemId);
		if (!item) return;
		const res = await fetch('/api/packing-items', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: itemId })
		});
		if (!res.ok) return;
		items = items.filter((currentItem) => currentItem.id !== itemId);
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

	function startEditing(item: PackingItem) {
		editingItemId = item.id;
		editName = item.name;
		editCategory = item.category;
		editQuantity = item.quantity;
		editNotes = item.notes ?? '';
		editPriority = item.priority;
	}

	async function saveEdit() {
		if (!editingItemId || !editName.trim()) return;
		const res = await fetch('/api/packing-items', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'update',
				id: editingItemId,
				name: editName.trim(),
				category: editCategory,
				quantity: editQuantity,
				notes: editNotes.trim() || null,
				priority: editPriority
			})
		});
		if (!res.ok) return;
		items = items.map((item) =>
			item.id === editingItemId
				? {
						...item,
						name: editName.trim(),
						category: editCategory,
						quantity: editQuantity,
						notes: editNotes.trim() || null,
						priority: editPriority
					}
				: item
		);
		editingItemId = null;
	}

	function cancelEdit() {
		editingItemId = null;
	}

	function toggleTripActivity(activityId: string) {
		if (tripActivities.includes(activityId)) {
			tripActivities = tripActivities.filter((id) => id !== activityId);
			return;
		}
		tripActivities = [...tripActivities, activityId];
	}

	function startTripEdit() {
		if (!trip) return;
		syncTripForm(trip);
		tripError = '';
		editingTrip = true;
	}

	function cancelTripEdit() {
		if (trip) syncTripForm(trip);
		tripError = '';
		editingTrip = false;
	}

	async function saveTripDetails() {
		if (!trip || tripSubmitting || !canSaveTripDetails) return;
		tripSubmitting = true;
		tripError = '';
		try {
			const res = await fetch('/api/trips', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: tripId,
					name: tripName.trim(),
					destination: tripDestination.trim(),
					country: tripCountry.trim() || null,
					startDate: new Date(tripStartDate).getTime(),
					endDate: new Date(tripEndDate).getTime(),
					activities: tripActivities,
					climate: tripClimate,
					travelers: tripTravelers,
					notes: tripNotes.trim() || null
				})
			});
			if (!res.ok) {
				const data = await res.json();
				tripError = data.error ?? 'Failed to update trip';
				return;
			}
			await loadData();
			editingTrip = false;
		} catch {
			tripError = 'Network error';
		} finally {
			tripSubmitting = false;
		}
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

	async function addCollaborator() {
		if (!collaboratorUsername.trim() || collaboratorSubmitting) return;
		collaboratorSubmitting = true;
		collaboratorError = '';
		const res = await fetch('/api/trips', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'addCollaborator',
				tripId,
				username: collaboratorUsername.trim()
			})
		});
		if (!res.ok) {
			const data = await res.json();
			collaboratorError = data.error ?? 'Failed to add collaborator';
			collaboratorSubmitting = false;
			return;
		}
		collaboratorUsername = '';
		collaboratorSubmitting = false;
		await loadData();
	}

	async function removeCollaborator(userId: string) {
		const res = await fetch('/api/trips', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: tripId, collaboratorUserId: userId })
		});
		if (!res.ok) return;
		collaborators = collaborators.filter((collaborator) => collaborator.userId !== userId);
	}

	async function savePresetFromTrip() {
		if (!presetName.trim() || savingPreset) return;
		savingPreset = true;
		presetError = '';
		const res = await fetch('/api/packing-presets', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'saveFromTrip', tripId, name: presetName.trim() })
		});
		if (!res.ok) {
			const data = await res.json();
			presetError = data.error ?? 'Failed to save preset';
			savingPreset = false;
			return;
		}
		presetName = '';
		savingPreset = false;
		presets = await (await fetch('/api/packing-presets')).json();
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

	function priorityBadgeClasses(priority: PackingItemPriority) {
		if (priority === 'must') return 'bg-red-50 text-red-700';
		if (priority === 'optional') return 'bg-slate-100 text-slate-500';
		return 'bg-blue-50 text-blue-700';
	}

	function reminderClasses(tone: ReminderSummary['tone']) {
		if (tone === 'urgent') return 'border-red-200 bg-red-50 text-red-700';
		if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
		return 'border-slate-200 bg-slate-50 text-slate-600';
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
					>AI Assistant</a
				>
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
					>Back to dashboard</a
				>
			</div>
		{:else if loading || !trip}
			<div class="flex items-center justify-center py-20">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
				></div>
			</div>
		{:else}
			<div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
				<section>
					<div class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
									onclick={startTripEdit}
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
									>{dayOfTravelMode
										? 'Disable day-of-travel mode'
										: 'Enable day-of-travel mode'}</button
								>
							</div>
						</div>

						{#if trip.reminder}
							<div
								class="mt-4 rounded-xl border px-4 py-3 text-sm font-medium {reminderClasses(
									trip.reminder.tone
								)}"
							>
								{trip.reminder.label}
							</div>
						{/if}

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
										<li>{getSeasonHint(trip.startDate, trip.destination, trip.climate)}</li>
									{/if}
								</ul>
							</div>
						{/if}

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
								<div class="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-4">
									<div class="grid gap-3 md:grid-cols-[2fr_1fr_80px_1fr]">
										<input
											id="new-item-name"
											type="text"
											bind:value={newItemName}
											placeholder="Item name"
											class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
										/>
										<select
											id="new-item-category"
											bind:value={newItemCategory}
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
											bind:value={newItemQuantity}
											class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
										/>
										<select
											bind:value={newItemPriority}
											class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
										>
											<option value="must">Must pack</option>
											<option value="normal">Normal</option>
											<option value="optional">Optional</option>
										</select>
									</div>
									<div class="mt-3 flex gap-3">
										<input
											type="text"
											bind:value={newItemNotes}
											placeholder="Optional note"
											class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
										/>
										<button
											onclick={addItem}
											disabled={!newItemName.trim()}
											class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
											>Add</button
										>
									</div>
								</div>
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
													<h2 class="text-sm font-semibold text-slate-800">{category}</h2>
													<span class="text-xs text-slate-400"
														>{packedInCategory}/{categoryItems.length}</span
													>
												</div>
												<button
													onclick={() => toggleCategory(category, !allPacked)}
													class="text-xs font-medium text-brand-600 hover:text-brand-700"
													>{allPacked ? 'Unpack visible' : 'Pack visible'}</button
												>
											</div>
											<ul>
												{#each categoryItems as item (item.id)}
													<li
														class="group flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
													>
														{#if editingItemId === item.id}
															<div
																class="grid flex-1 gap-2 md:grid-cols-[2fr_1fr_80px_1fr_1fr_auto_auto]"
															>
																<input
																	type="text"
																	bind:value={editName}
																	class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
																/>
																<select
																	bind:value={editCategory}
																	class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
																	>{#each CATEGORIES as currentCategory (currentCategory)}<option
																			value={currentCategory}>{currentCategory}</option
																		>{/each}</select
																>
																<input
																	type="number"
																	min="1"
																	bind:value={editQuantity}
																	class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
																/>
																<select
																	bind:value={editPriority}
																	class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
																	><option value="must">Must</option><option value="normal"
																		>Normal</option
																	><option value="optional">Optional</option></select
																>
																<input
																	type="text"
																	bind:value={editNotes}
																	placeholder="Optional note"
																	class="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
																/>
																<button
																	onclick={saveEdit}
																	class="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700"
																	>Save</button
																>
																<button
																	onclick={cancelEdit}
																	class="rounded bg-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-300"
																	>Cancel</button
																>
															</div>
														{:else}
															<button
																onclick={() => toggleItem(item.id)}
																class="flex h-5 w-5 shrink-0 items-center justify-center rounded border {item.packed
																	? 'border-emerald-500 bg-emerald-500'
																	: 'border-slate-300 hover:border-brand-500'}"
																>{#if item.packed}<svg
																		class="h-3 w-3 text-white"
																		viewBox="0 0 20 20"
																		fill="currentColor"
																		><path
																			fill-rule="evenodd"
																			d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
																			clip-rule="evenodd"
																		/></svg
																	>{/if}</button
															>
															<div class="flex-1">
																<div class="flex flex-wrap items-center gap-2">
																	<span
																		class="text-sm {item.packed
																			? 'text-slate-400 line-through'
																			: 'text-slate-800'}">{item.name}</span
																	><span
																		class="rounded-full px-1.5 py-0.5 text-[10px] font-medium {priorityBadgeClasses(
																			item.priority
																		)}">{item.priority}</span
																	>{#if isCriticalItem(item)}<span
																			class="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
																			>Critical</span
																		>{/if}{#if item.isCustom}<span
																			class="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600"
																			>Custom</span
																		>{/if}
																</div>
																{#if item.notes}<div class="mt-0.5 text-xs text-slate-500">
																		{item.notes}
																	</div>{/if}
															</div>
															{#if item.quantity > 1}<span
																	class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
																	>x{item.quantity}</span
																>{/if}
															<div
																class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
															>
																<button
																	onclick={() => startEditing(item)}
																	class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
																	aria-label="Edit item">Edit</button
																>
																<button
																	onclick={() => removeItem(item.id)}
																	class="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
																	aria-label="Remove item">Remove</button
																>
															</div>
														{/if}
													</li>
												{/each}
											</ul>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</section>

				<aside class="space-y-6">
					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h2 class="text-base font-semibold text-slate-900">Collaborators</h2>
						<p class="mt-1 text-sm text-slate-500">Share this trip with other PackPal users.</p>
						{#if !trip.isShared}
							<div class="mt-4 flex gap-2">
								<input
									type="text"
									bind:value={collaboratorUsername}
									placeholder="username"
									class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
								/>
								<button
									onclick={addCollaborator}
									disabled={!collaboratorUsername.trim() || collaboratorSubmitting}
									class="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
									>Add</button
								>
							</div>
							{#if collaboratorError}<p class="mt-2 text-sm text-red-600">
									{collaboratorError}
								</p>{/if}
						{/if}
						<ul class="mt-4 space-y-2">
							<li
								class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
							>
								<span>{trip.ownerDisplayName} (owner)</span>
							</li>
							{#each collaborators as collaborator (collaborator.id)}
								<li
									class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
								>
									<span
										>{collaborator.displayName}
										<span class="text-slate-400">@{collaborator.username}</span></span
									>
									{#if !trip.isShared}<button
											onclick={() => removeCollaborator(collaborator.userId)}
											class="text-xs font-medium text-red-500 hover:text-red-600">Remove</button
										>{/if}
								</li>
							{/each}
						</ul>
					</div>

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
								onclick={savePresetFromTrip}
								disabled={!presetName.trim() || savingPreset}
								class="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
								>Save</button
							>
						</div>
						{#if presetError}<p class="mt-2 text-sm text-red-600">{presetError}</p>{/if}
						<ul class="mt-4 space-y-2">
							{#if presets.length === 0}
								<li class="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
									No presets yet.
								</li>
							{:else}
								{#each presets.slice(0, 5) as preset (preset.id)}
									<li class="rounded-lg bg-slate-50 px-3 py-3">
										<div class="flex items-center justify-between gap-2">
											<div>
												<div class="text-sm font-medium text-slate-800">{preset.name}</div>
												<div class="text-xs text-slate-500">{preset.items.length} items</div>
											</div>
											<button
												onclick={() => applyPreset(preset)}
												class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
												>Apply</button
											>
										</div>
									</li>
								{/each}
							{/if}
						</ul>
					</div>

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
							<li>{dayOfTravelMode ? 'Day-of-travel sorting enabled' : 'Standard packing view'}</li>
						</ul>
					</div>
				</aside>
			</div>
		{/if}
	</main>

	{#if toast}
		<div
			class="fixed right-4 bottom-4 z-50 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
		>
			<div class="flex items-center gap-3 text-sm text-slate-700">
				<span>{toast.message}</span>
				{#if toast.action}
					<button
						onclick={() => toast?.action?.()}
						class="font-semibold text-brand-600 hover:text-brand-700">{toast.undoLabel}</button
					>
				{/if}
			</div>
		</div>
	{/if}

	{#if editingTrip}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="trip-edit-title"
		>
			<div class="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
				<div class="sticky top-0 border-b border-slate-200 bg-white px-6 py-4">
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 id="trip-edit-title" class="text-base font-semibold text-slate-900">
								Edit trip details
							</h2>
							<p class="text-sm text-slate-500">
								Changing activities or climate safely regenerates template items while keeping your
								custom items.
							</p>
						</div>
						<button
							onclick={cancelTripEdit}
							class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
							aria-label="Close trip editor">Close</button
						>
					</div>
				</div>

				<div class="p-6">
					{#if tripError}<div
							class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
						>
							{tripError}
						</div>{/if}
					<div class="grid gap-4 sm:grid-cols-2">
						<input
							id="trip-name"
							type="text"
							bind:value={tripName}
							placeholder="Trip name"
							class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<input
							id="trip-destination"
							type="text"
							bind:value={tripDestination}
							placeholder="Destination"
							class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<input
							id="trip-country"
							type="text"
							bind:value={tripCountry}
							placeholder="Country"
							class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<input
							id="trip-travelers"
							type="number"
							min="1"
							bind:value={tripTravelers}
							class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<input
							id="trip-start-date"
							type="date"
							bind:value={tripStartDate}
							class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<input
							id="trip-end-date"
							type="date"
							bind:value={tripEndDate}
							min={tripStartDate}
							class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<select
							id="trip-climate"
							bind:value={tripClimate}
							class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
							>{#each CLIMATE_OPTIONS as option (option.id)}<option value={option.id}
									>{option.name}</option
								>{/each}</select
						>
					</div>
					<div class="mt-5 space-y-4">
						{#each ACTIVITY_GROUPS as group (group.id)}
							{@const groupActivities = ACTIVITIES.filter(
								(activity) => activity.group === group.id
							)}
							<div>
								<h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
									{group.name}
								</h3>
								<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{#each groupActivities as activity (activity.id)}
										{@const selected = tripActivities.includes(activity.id)}
										<button
											type="button"
											onclick={() => toggleTripActivity(activity.id)}
											class="flex items-start gap-3 rounded-lg border p-3 text-left transition-all {selected
												? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
												: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}"
										>
											<span class="mt-0.5 text-xl">{@html activity.icon}</span>
											<div class="min-w-0 flex-1">
												<div class="text-sm font-medium text-slate-900">{activity.name}</div>
												<div class="text-xs text-slate-500">{activity.description}</div>
											</div>
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
					<textarea
						id="trip-notes"
						rows={3}
						bind:value={tripNotes}
						class="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					></textarea>
				</div>

				<div class="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
					<div class="flex items-center justify-end gap-2">
						<button
							onclick={cancelTripEdit}
							class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
							>Cancel</button
						>
						<button
							onclick={saveTripDetails}
							disabled={tripSubmitting || !canSaveTripDetails}
							class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
							>{tripSubmitting ? 'Saving...' : 'Save Changes'}</button
						>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

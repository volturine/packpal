<script lang="ts">
	import { getContext } from 'svelte';
	import { formatActivityNames } from '$lib/packing-insights';
	import { formatDate, reminderClasses } from '$lib/format';
	import type { AuthUser, Trip } from '$lib/types';

	const auth = getContext<{ user: AuthUser | null; logout: () => Promise<void> }>('auth');

	let trips = $state<Trip[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'upcoming' | 'active' | 'completed'>('all');
	let tripScope = $state<'active' | 'archived'>('active');
	let sortBy = $state<'departure' | 'progress' | 'recent'>('departure');

	async function loadTrips() {
		loading = true;
		try {
			const res = await fetch('/api/trips');
			if (res.ok) {
				trips = await res.json();
			}
		} finally {
			loading = false;
		}
	}

	function tripProgress(trip: Trip) {
		const itemCount = trip.itemCount ?? 0;
		const packedCount = trip.packedCount ?? 0;
		return itemCount > 0 ? Math.round((packedCount / itemCount) * 100) : 0;
	}

	function matchesSearch(trip: Trip) {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return true;
		return [
			trip.name,
			trip.destination,
			trip.country ?? '',
			...(trip.ownerDisplayName ? [trip.ownerDisplayName] : [])
		]
			.join(' ')
			.toLowerCase()
			.includes(query);
	}

	const visibleTrips = $derived.by(() => {
		let filtered = trips.filter((trip) => Boolean(trip.archivedAt) === (tripScope === 'archived'));
		if (statusFilter !== 'all') {
			filtered = filtered.filter((trip) => trip.tripStatus === statusFilter);
		}
		filtered = filtered.filter(matchesSearch);

		return [...filtered].sort((a, b) => {
			if (sortBy === 'recent') return b.createdAt - a.createdAt;
			if (sortBy === 'progress') return tripProgress(b) - tripProgress(a);
			return a.startDate - b.startDate;
		});
	});

	const stats = $derived.by(() => ({
		active: trips.filter((trip) => !trip.archivedAt).length,
		archived: trips.filter((trip) => trip.archivedAt).length,
		shared: trips.filter((trip) => trip.isShared).length,
		critical: trips.reduce((total, trip) => total + (trip.criticalUnpackedCount ?? 0), 0)
	}));

	async function handleDelete(tripId: string) {
		if (!confirm('Delete this trip and all its packing items?')) return;
		await fetch('/api/trips', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: tripId })
		});
		trips = trips.filter((trip) => trip.id !== tripId);
	}

	async function archiveTrip(tripId: string, archived: boolean) {
		const res = await fetch('/api/trips', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: tripId, action: archived ? 'archive' : 'unarchive' })
		});
		if (!res.ok) return;
		trips = trips.map((trip) =>
			trip.id === tripId ? { ...trip, archivedAt: archived ? Date.now() : null } : trip
		);
	}

	async function toggleTripPacking(trip: Trip, packed: boolean) {
		const res = await fetch('/api/packing-items', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'toggleTrip', tripId: trip.id, packed })
		});
		if (!res.ok) return;

		const itemCount = trip.itemCount ?? 0;
		trips = trips.map((currentTrip) =>
			currentTrip.id === trip.id
				? {
						...currentTrip,
						packedCount: packed ? itemCount : 0,
						criticalUnpackedCount: packed ? 0 : currentTrip.criticalUnpackedCount
					}
				: currentTrip
		);
	}

	$effect(() => {
		loadTrips();
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
			<div class="flex items-center gap-3">
				<a
					href="/app/trips/new"
					class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700"
				>
					+ New Trip
				</a>
				<div class="flex items-center gap-2">
					<a href="/app/profile" class="text-sm text-slate-600 hover:text-brand-600"
						>{auth.user?.displayName}</a
					>
					<button
						onclick={auth.logout}
						class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
					>
						Sign out
					</button>
				</div>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-8">
		{#if loading}
			<div class="flex items-center justify-center py-20">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
				></div>
			</div>
		{:else if trips.length === 0}
			<div class="py-20 text-center">
				<div
					class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-4xl"
				>
					&#x1F9F3;
				</div>
				<h2 class="text-xl font-semibold text-slate-900">No trips yet</h2>
				<p class="mt-2 text-slate-500">Create your first trip and we'll help you pack perfectly.</p>
				<a
					href="/app/trips/new"
					class="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
				>
					Create Your First Trip
				</a>
			</div>
		{:else}
			<div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 class="text-2xl font-bold text-slate-900">Your Trips</h1>
					<p class="mt-1 text-sm text-slate-500">
						Shared packing, archived trips, and reminders in one view.
					</p>
				</div>
				<div class="grid gap-2 sm:grid-cols-4">
					<div class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
						<div class="text-slate-400">Active</div>
						<div class="text-lg font-semibold text-slate-900">{stats.active}</div>
					</div>
					<div class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
						<div class="text-slate-400">Archived</div>
						<div class="text-lg font-semibold text-slate-900">{stats.archived}</div>
					</div>
					<div class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
						<div class="text-slate-400">Shared With You</div>
						<div class="text-lg font-semibold text-slate-900">{stats.shared}</div>
					</div>
					<div class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
						<div class="text-slate-400">Critical Left</div>
						<div class="text-lg font-semibold text-red-600">{stats.critical}</div>
					</div>
				</div>
			</div>

			<div class="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div class="flex flex-wrap gap-2">
						<button
							onclick={() => (tripScope = 'active')}
							class="rounded-lg px-3 py-2 text-sm font-medium {tripScope === 'active'
								? 'bg-brand-600 text-white'
								: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
						>
							Active Trips
						</button>
						<button
							onclick={() => (tripScope = 'archived')}
							class="rounded-lg px-3 py-2 text-sm font-medium {tripScope === 'archived'
								? 'bg-brand-600 text-white'
								: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
						>
							Archived Trips
						</button>
					</div>
					<div class="grid gap-2 sm:grid-cols-3">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search trips"
							class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<select
							bind:value={statusFilter}
							class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
						>
							<option value="all">All statuses</option>
							<option value="upcoming">Upcoming</option>
							<option value="active">Active</option>
							<option value="completed">Completed</option>
						</select>
						<select
							bind:value={sortBy}
							class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
						>
							<option value="departure">Sort by departure</option>
							<option value="progress">Sort by progress</option>
							<option value="recent">Sort by recent</option>
						</select>
					</div>
				</div>
			</div>

			{#if visibleTrips.length === 0}
				<div
					class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500"
				>
					No trips match the current view.
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{#each visibleTrips as trip (trip.id)}
						{@const progress = tripProgress(trip)}
						<div
							class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
						>
							<div class="mb-3 flex items-start justify-between gap-3">
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="rounded-full px-2.5 py-0.5 text-xs font-medium {trip.tripStatus ===
										'active'
											? 'bg-emerald-100 text-emerald-700'
											: trip.tripStatus === 'upcoming'
												? 'bg-blue-100 text-blue-700'
												: 'bg-slate-100 text-slate-500'}"
									>
										{trip.tripStatus}
									</span>
									{#if trip.isShared}
										<span
											class="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
											>Shared</span
										>
									{/if}
									{#if trip.criticalUnpackedCount}
										<span
											class="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
											>{trip.criticalUnpackedCount} critical left</span
										>
									{/if}
								</div>
								<div class="relative z-20 flex items-center gap-1">
									<button
										onclick={() => toggleTripPacking(trip, true)}
										class="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
										>Pack all</button
									>
									<button
										onclick={() => toggleTripPacking(trip, false)}
										class="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
										>Unpack all</button
									>
									<button
										onclick={() => archiveTrip(trip.id, !trip.archivedAt)}
										class="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
										>{trip.archivedAt ? 'Restore' : 'Archive'}</button
									>
									{#if !trip.isShared}
										<button
											onclick={() => handleDelete(trip.id)}
											class="rounded-md px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50"
										>
											Delete
										</button>
									{/if}
								</div>
							</div>

							<a href="/app/trips/{trip.id}" class="block">
								<h3 class="truncate text-base font-semibold text-slate-900">{trip.name}</h3>
								<p class="mt-1 text-sm text-slate-500">
									{trip.destination}{trip.country ? `, ${trip.country}` : ''}
								</p>
							</a>

							<div class="mt-3 space-y-2 text-xs text-slate-500">
								<div class="flex items-center justify-between">
									<span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
									{#if trip.countdownLabel && trip.tripStatus === 'upcoming'}
										<span class="font-medium text-brand-600">{trip.countdownLabel} to go</span>
									{/if}
								</div>
								<div>
									{trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}
									{#if trip.ownerDisplayName}
										• owner: {trip.ownerDisplayName}
									{/if}
									{#if trip.collaboratorCount}
										• {trip.collaboratorCount} collaborator{trip.collaboratorCount === 1 ? '' : 's'}
									{/if}
								</div>
							</div>

							<div class="mt-3">
								<div class="mb-1 flex items-center justify-between text-[11px] text-slate-500">
									<span>{trip.packedCount ?? 0}/{trip.itemCount ?? 0} packed</span>
									<span>{progress}%</span>
								</div>
								<div class="h-1.5 overflow-hidden rounded-full bg-slate-200">
									<div
										class="h-full rounded-full bg-brand-500 transition-all"
										style="width: {progress}%"
									></div>
								</div>
							</div>

							{#if trip.reminder}
								<div
									class="mt-3 rounded-xl border px-3 py-2 text-xs font-medium {reminderClasses(
										trip.reminder.tone
									)}"
								>
									{trip.reminder.label}
								</div>
							{/if}

							{#if trip.contradictions?.length}
								<p class="mt-3 text-xs text-amber-700">{trip.contradictions[0]?.message}</p>
							{/if}

							<div class="mt-3 flex flex-wrap gap-1">
								{#each formatActivityNames(trip.activities).slice(0, 3) as activity (activity)}
									<span
										class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
										>{activity}</span
									>
								{/each}
								{#if trip.activities.length > 3}
									<span
										class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400"
										>+{trip.activities.length - 3}</span
									>
								{/if}
							</div>

							<div class="mt-4 flex flex-wrap gap-2">
								<a
									href="/app/trips/{trip.id}"
									class="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
									>Open Trip</a
								>
								<a
									href="/app/trips/{trip.id}/chat"
									class="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
									>Open Chat</a
								>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</main>
</div>

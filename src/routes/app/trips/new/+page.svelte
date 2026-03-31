<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { goto } from '$app/navigation';
	import { ACTIVITIES, ACTIVITY_GROUPS, type Climate } from '$lib/data/packing-templates';
	import { getInitialTripItems } from '$lib/trip-items';
	import type { PackingPreset } from '$lib/types';

	let name = $state('');
	let destination = $state('');
	let country = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let climate = $state<Climate>('temperate');
	let travelers = $state(1);
	let notes = $state('');
	let selectedActivities = $state<string[]>([]);
	let selectedPresetId = $state('');
	let presets = $state<PackingPreset[]>([]);
	let step = $state(1);
	let submitting = $state(false);
	let error = $state('');

	const CLIMATES: { id: Climate; label: string; icon: string; description: string }[] = [
		{
			id: 'tropical',
			label: 'Tropical',
			icon: '&#x1F334;',
			description: 'Hot & humid (Southeast Asia, Caribbean, etc.)'
		},
		{
			id: 'temperate',
			label: 'Temperate',
			icon: '&#x1F343;',
			description: 'Mild seasons (Europe, East Coast US, etc.)'
		},
		{
			id: 'cold',
			label: 'Cold',
			icon: '&#x2744;',
			description: 'Freezing or sub-zero (Alps, Scandinavia, etc.)'
		},
		{
			id: 'arid',
			label: 'Arid / Desert',
			icon: '&#x1F3DC;',
			description: 'Hot & dry (Sahara, Middle East, etc.)'
		},
		{
			id: 'mixed',
			label: 'Mixed / Varies',
			icon: '&#x1F326;',
			description: "Unpredictable or you're visiting multiple zones"
		}
	];

	function toggleActivity(id: string) {
		if (selectedActivities.includes(id)) {
			selectedActivities = selectedActivities.filter((activity) => activity !== id);
			return;
		}
		selectedActivities = [...selectedActivities, id];
	}

	const canProceedStep1 = $derived(
		name.trim() !== '' &&
			destination.trim() !== '' &&
			startDate !== '' &&
			endDate !== '' &&
			new Date(endDate) >= new Date(startDate)
	);
	const canProceedStep2 = $derived(selectedActivities.length > 0);
	const selectedPreset = $derived(presets.find((preset) => preset.id === selectedPresetId) ?? null);
	const previewItems = $derived.by(() => {
		return getInitialTripItems(selectedActivities, climate, selectedPreset?.items ?? []);
	});
	const previewByCategory = $derived.by(() => {
		const entries: [string, number][] = [];
		for (const item of previewItems) {
			const existing = entries.find(([key]) => key === item.category);
			if (existing) {
				existing[1]++;
			} else {
				entries.push([item.category, 1]);
			}
		}
		return entries.sort((a, b) => b[1] - a[1]);
	});

	async function loadPresets() {
		const res = await fetch('/api/packing-presets');
		if (res.ok) presets = await res.json();
	}

	async function handleSubmit() {
		if (submitting) return;
		submitting = true;
		error = '';

		try {
			const tripRes = await fetch('/api/trips', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					destination: destination.trim(),
					country: country.trim() || undefined,
					startDate: new Date(startDate).getTime(),
					endDate: new Date(endDate).getTime(),
					activities: selectedActivities,
					climate,
					travelers,
					notes: notes.trim() || undefined
				})
			});

			if (!tripRes.ok) {
				const data = await tripRes.json();
				throw new Error(data.error ?? 'Failed to create trip');
			}

			const { id: tripId } = await tripRes.json();
			const initialItems = getInitialTripItems(
				selectedActivities,
				climate,
				selectedPreset?.items ?? []
			);

			await fetch('/api/packing-items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tripId,
					items: initialItems
				})
			});

			if (selectedPreset) {
				await fetch('/api/packing-presets', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: selectedPreset.id, action: 'markUsed' })
				});
			}

			await goto(`/app/trips/${tripId}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		loadPresets();
	});
</script>

<div class="min-h-screen bg-surface font-sans text-slate-900">
	<AppHeader backHref="/app" backLabel="Cancel" />

	<main class="mx-auto max-w-4xl px-6 py-8">
		<div class="mb-8">
			<div class="mb-2 flex items-center justify-between text-sm text-slate-500">
				<span>Step {step} of 3</span>
				<span class="font-medium text-slate-700"
					>{step === 1
						? 'Trip Details'
						: step === 2
							? 'Activities & Preset'
							: 'Review & Create'}</span
				>
			</div>
			<div class="h-1.5 overflow-hidden rounded-full bg-slate-200">
				<div
					class="h-full rounded-full bg-brand-600 transition-all duration-300"
					style="width: {(step / 3) * 100}%"
				></div>
			</div>
		</div>

		{#if step === 1}
			<div>
				<h1 class="mb-1 text-2xl font-bold">Where are you going?</h1>
				<p class="mb-6 text-sm text-slate-500">
					Tell us about your trip so we can build the perfect packing list.
				</p>
				<div class="space-y-5">
					<input
						id="name"
						type="text"
						bind:value={name}
						placeholder="Trip name"
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					/>
					<div class="grid gap-4 sm:grid-cols-2">
						<input
							id="destination"
							type="text"
							bind:value={destination}
							placeholder="Destination"
							class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<input
							id="country"
							type="text"
							bind:value={country}
							placeholder="Country (optional)"
							class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<input
							id="start-date"
							type="date"
							bind:value={startDate}
							class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<input
							id="end-date"
							type="date"
							bind:value={endDate}
							min={startDate}
							class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
					</div>
					<div class="flex gap-4">
						<input
							id="travelers"
							type="number"
							min="1"
							max="20"
							bind:value={travelers}
							class="w-24 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
						<select
							bind:value={climate}
							class="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
						>
							{#each CLIMATES as currentClimate (currentClimate.id)}
								<option value={currentClimate.id}>{currentClimate.label}</option>
							{/each}
						</select>
					</div>
					<textarea
						id="notes"
						bind:value={notes}
						rows={3}
						placeholder="Anything special about this trip..."
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					></textarea>
				</div>
				<div class="mt-8 flex justify-end">
					<button
						disabled={!canProceedStep1}
						onclick={() => (step = 2)}
						class="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
						>Next: Activities & Preset</button
					>
				</div>
			</div>
		{:else if step === 2}
			<div>
				<h1 class="mb-1 text-2xl font-bold">Activities and presets</h1>
				<p class="mb-6 text-sm text-slate-500">
					Choose activities and optionally layer in one of your saved custom-item presets.
				</p>
				<div class="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<label for="preset-select" class="mb-2 block text-sm font-medium text-slate-700"
						>Packing preset</label
					>
					<select
						id="preset-select"
						bind:value={selectedPresetId}
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
					>
						<option value="">No preset</option>
						{#each presets as preset (preset.id)}
							<option value={preset.id}>{preset.name} ({preset.items.length} items)</option>
						{/each}
					</select>
					{#if selectedPreset}
						<p class="mt-2 text-sm text-slate-500">
							This preset will add {selectedPreset.items.length} reusable custom items.
						</p>
					{/if}
				</div>

				{#each ACTIVITY_GROUPS as group (group.id)}
					{@const groupActivities = ACTIVITIES.filter((activity) => activity.group === group.id)}
					<div class="mb-6">
						<h2 class="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
							{group.name}
						</h2>
						<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{#each groupActivities as activity (activity.id)}
								{@const selected = selectedActivities.includes(activity.id)}
								<button
									type="button"
									onclick={() => toggleActivity(activity.id)}
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

				<div class="mt-8 flex items-center justify-between">
					<button
						onclick={() => (step = 1)}
						class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
						>Back</button
					>
					<button
						disabled={!canProceedStep2}
						onclick={() => (step = 3)}
						class="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
						>Next: Review</button
					>
				</div>
			</div>
		{:else}
			<div>
				<h1 class="mb-1 text-2xl font-bold">Review your trip</h1>
				<p class="mb-6 text-sm text-slate-500">
					Everything looks good? We'll generate your base list and optionally apply your preset.
				</p>
				{#if error}<div
						class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
					>
						{error}
					</div>{/if}
				<div class="space-y-4">
					<div class="rounded-xl border border-slate-200 bg-white p-5">
						<h2 class="text-lg font-semibold">{name || 'Untitled Trip'}</h2>
						<div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
							<div>
								<span class="text-slate-500">Destination:</span>
								<span class="font-medium">{destination}{country ? `, ${country}` : ''}</span>
							</div>
							<div>
								<span class="text-slate-500">Dates:</span>
								<span class="font-medium"
									>{new Date(startDate).toLocaleDateString()} - {new Date(
										endDate
									).toLocaleDateString()}</span
								>
							</div>
							<div>
								<span class="text-slate-500">Climate:</span>
								<span class="font-medium capitalize">{climate}</span>
							</div>
							<div>
								<span class="text-slate-500">Travelers:</span>
								<span class="font-medium">{travelers}</span>
							</div>
						</div>
						{#if notes}<p class="mt-3 text-sm text-slate-500">{notes}</p>{/if}
					</div>
					<div class="rounded-xl border border-slate-200 bg-white p-5">
						<h2 class="text-base font-semibold">Activities and preset</h2>
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#each selectedActivities as actId (actId)}{@const act = ACTIVITIES.find(
									(activity) => activity.id === actId
								)}{#if act}<span
										class="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
										>{act.name}</span
									>{/if}{/each}
						</div>
						{#if selectedPreset}<p class="mt-3 text-sm text-slate-500">
								Preset: <span class="font-medium text-slate-700">{selectedPreset.name}</span>
							</p>{/if}
					</div>
					<div class="rounded-xl border border-slate-200 bg-white p-5">
						<h2 class="mb-3 text-base font-semibold">
							Packing preview <span class="text-sm font-normal text-slate-400"
								>({previewItems.length} items)</span
							>
						</h2>
						<div class="grid gap-2 sm:grid-cols-2">
							{#each previewByCategory as [category, count] (category)}<div
									class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
								>
									<span class="text-sm text-slate-700">{category}</span><span
										class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600"
										>{count}</span
									>
								</div>{/each}
						</div>
					</div>
				</div>
				<div class="mt-8 flex items-center justify-between">
					<button
						onclick={() => (step = 2)}
						class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
						>Back</button
					>
					<button
						disabled={submitting}
						onclick={handleSubmit}
						class="rounded-lg bg-brand-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
						>{submitting ? 'Creating...' : 'Create Trip & Generate List'}</button
					>
				</div>
			</div>
		{/if}
	</main>
</div>

<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import {
		ACTIVITIES,
		ACTIVITY_GROUPS,
		CLIMATE_OPTIONS,
		type Climate
	} from '$lib/data/packing-templates';
	import type { Trip } from '$lib/types';
	import { toDateInputValue } from '$lib/format';

	interface Props {
		open: boolean;
		trip: Trip;
		onclose: () => void;
		onsave: (data: {
			name: string;
			destination: string;
			country: string | null;
			startDate: number;
			endDate: number;
			activities: string[];
			climate: Climate;
			travelers: number;
			notes: string | null;
		}) => Promise<void>;
	}

	const { open, trip, onclose, onsave }: Props = $props();

	let submitting = $state(false);
	let error = $state('');
	let name = $state('');
	let destination = $state('');
	let country = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let travelers = $state(1);
	let notes = $state('');
	let climate = $state<Climate>('temperate');
	let activities = $state<string[]>([]);

	const canSave = $derived(
		name.trim() !== '' &&
			destination.trim() !== '' &&
			startDate !== '' &&
			endDate !== '' &&
			travelers > 0 &&
			activities.length > 0 &&
			new Date(endDate) >= new Date(startDate)
	);

	function syncForm() {
		name = trip.name;
		destination = trip.destination;
		country = trip.country ?? '';
		startDate = toDateInputValue(trip.startDate);
		endDate = toDateInputValue(trip.endDate);
		travelers = trip.travelers;
		notes = trip.notes ?? '';
		climate = trip.climate;
		activities = [...trip.activities];
		error = '';
	}

	function toggleActivity(activityId: string) {
		if (activities.includes(activityId)) {
			activities = activities.filter((id) => id !== activityId);
		} else {
			activities = [...activities, activityId];
		}
	}

	function handleClose() {
		syncForm();
		onclose();
	}

	async function handleSave() {
		if (submitting || !canSave) return;
		submitting = true;
		error = '';
		try {
			await onsave({
				name: name.trim(),
				destination: destination.trim(),
				country: country.trim() || null,
				startDate: new Date(startDate).getTime(),
				endDate: new Date(endDate).getTime(),
				activities,
				climate,
				travelers,
				notes: notes.trim() || null
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update trip';
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		if (open) syncForm();
	});
</script>

<Modal
	{open}
	title="Edit trip details"
	description="Changing activities or climate safely regenerates template items while keeping your custom items."
	onclose={handleClose}
>
	{#if error}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
			{error}
		</div>
	{/if}
	<div class="grid gap-4 sm:grid-cols-2">
		<input
			type="text"
			bind:value={name}
			placeholder="Trip name"
			class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<input
			type="text"
			bind:value={destination}
			placeholder="Destination"
			class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<input
			type="text"
			bind:value={country}
			placeholder="Country"
			class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<input
			type="number"
			min="1"
			bind:value={travelers}
			class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<input
			type="date"
			bind:value={startDate}
			class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<input
			type="date"
			bind:value={endDate}
			min={startDate}
			class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
		/>
		<select
			bind:value={climate}
			class="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
		>
			{#each CLIMATE_OPTIONS as option (option.id)}
				<option value={option.id}>{option.name}</option>
			{/each}
		</select>
	</div>
	<div class="mt-5 space-y-4">
		{#each ACTIVITY_GROUPS as group (group.id)}
			{@const groupActivities = ACTIVITIES.filter((activity) => activity.group === group.id)}
			<div>
				<h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
					{group.name}
				</h3>
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each groupActivities as activity (activity.id)}
						{@const selected = activities.includes(activity.id)}
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
	</div>
	<textarea
		rows={3}
		bind:value={notes}
		class="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
	></textarea>

	{#snippet footer()}
		<div class="flex items-center justify-end gap-2">
			<button
				onclick={handleClose}
				class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
			>
				Cancel
			</button>
			<button
				onclick={handleSave}
				disabled={submitting || !canSave}
				class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{submitting ? 'Saving...' : 'Save Changes'}
			</button>
		</div>
	{/snippet}
</Modal>

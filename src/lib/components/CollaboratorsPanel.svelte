<script lang="ts">
	import type { TripCollaborator, Trip } from '$lib/types';

	interface Props {
		trip: Trip;
		collaborators: TripCollaborator[];
		onadd: (username: string) => Promise<string | null>;
		onremove: (userId: string) => void;
	}

	const { trip, collaborators, onadd, onremove }: Props = $props();

	let username = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function addCollaborator() {
		if (!username.trim() || submitting) return;
		submitting = true;
		error = '';
		const result = await onadd(username.trim());
		if (result) {
			error = result;
		} else {
			username = '';
		}
		submitting = false;
	}
</script>

<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
	<h2 class="text-base font-semibold text-slate-900">Collaborators</h2>
	<p class="mt-1 text-sm text-slate-500">Share this trip with other PackPal users.</p>
	{#if !trip.isShared}
		<div class="mt-4 flex gap-2">
			<input
				type="text"
				bind:value={username}
				placeholder="username"
				class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
			/>
			<button
				onclick={addCollaborator}
				disabled={!username.trim() || submitting}
				class="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
			>
				Add
			</button>
		</div>
		{#if error}
			<p class="mt-2 text-sm text-red-600">{error}</p>
		{/if}
	{/if}
	<ul class="mt-4 space-y-2">
		<li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
			<span>{trip.ownerDisplayName} (owner)</span>
		</li>
		{#each collaborators as collaborator (collaborator.id)}
			<li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
				<span>
					{collaborator.displayName}
					<span class="text-slate-400">@{collaborator.username}</span>
				</span>
				{#if !trip.isShared}
					<button
						onclick={() => onremove(collaborator.userId)}
						class="text-xs font-medium text-red-500 hover:text-red-600"
					>
						Remove
					</button>
				{/if}
			</li>
		{/each}
	</ul>
</div>

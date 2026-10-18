<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import {
		createBillingRequestId,
		formatCredit,
		type BillingSummary,
		type CreditPurchaseStatus
	} from '$lib/billing';
	import { onMount } from 'svelte';

	type HistoryEntry =
		| {
				kind: 'purchase';
				status: CreditPurchaseStatus;
				id: string;
				createdAt: number;
				amountCents: number;
				creditedMicroUsd: number;
		  }
		| {
				kind: 'request';
				id: string;
				createdAt: number;
				chargedMicroUsd: number | null;
				reservedMicroUsd: number;
		  };

	const purchaseLabels: Record<CreditPurchaseStatus, string> = {
		pending: 'Awaiting payment',
		paid: 'Paid',
		partially_refunded: 'Partially refunded',
		refunded: 'Refunded',
		disputed: 'Payment disputed'
	};
	const topupOptions = [500, 1000, 2500];
	const usdFormatter = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2
	});

	let summary = $state<BillingSummary | null>(null);
	let billingLoading = $state(true);
	let billingError = $state('');
	let checkoutBusy = $state(false);
	let checkoutError = $state('');
	let checkoutNotice = $state('');
	let showRefreshBalance = $state(false);
	let selectedAmountCents = $state(500);
	let checkoutRequestId = $state<string | null>(null);

	const history = $derived.by((): HistoryEntry[] => {
		if (!summary) return [];
		return [
			...summary.purchases.map((purchase) => ({
				kind: 'purchase' as const,
				status: purchase.status,
				id: purchase.id,
				createdAt: purchase.createdAt,
				amountCents: purchase.amountCents,
				creditedMicroUsd: purchase.creditedMicroUsd
			})),
			...summary.requests.map((request) => ({
				kind: 'request' as const,
				id: request.id,
				createdAt: request.createdAt,
				chargedMicroUsd: request.chargedMicroUsd,
				reservedMicroUsd: request.reservedMicroUsd
			}))
		].sort((a, b) => b.createdAt - a.createdAt);
	});

	function formatDate(timestamp: number) {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}

	async function loadBillingSummary() {
		billingLoading = true;
		billingError = '';
		try {
			const response = await fetch('/api/billing');
			if (!response.ok) throw new Error('Unable to load AI credits. Please try again.');
			summary = (await response.json()) as BillingSummary;
		} catch {
			billingError = 'Unable to load AI credits. Please try again.';
		} finally {
			billingLoading = false;
		}
	}

	function selectTopup(amountCents: number) {
		if (selectedAmountCents !== amountCents) {
			selectedAmountCents = amountCents;
			checkoutRequestId = null;
		}
		checkoutError = '';
	}

	async function startCheckout() {
		if (checkoutBusy || !summary?.checkoutEnabled) return;

		checkoutBusy = true;
		checkoutError = '';

		try {
			const requestId = (checkoutRequestId ??= createBillingRequestId());
			const response = await fetch('/api/billing/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					requestId,
					amountCents: selectedAmountCents
				})
			});
			if (!response.ok) throw new Error('Unable to start checkout. Please try again.');

			const result = (await response.json()) as { url?: unknown };
			if (
				typeof result.url !== 'string' ||
				!result.url.startsWith('https://checkout.stripe.com/')
			) {
				throw new Error('Unable to start checkout. Please try again.');
			}
			const checkoutUrl = new URL(result.url);
			if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
				throw new Error('Unable to start checkout. Please try again.');
			}

			checkoutRequestId = null;
			window.location.assign(checkoutUrl.href);
		} catch {
			checkoutError = 'Unable to start checkout. Please try again.';
		} finally {
			checkoutBusy = false;
		}
	}

	onMount(() => {
		const checkoutStatus = new URLSearchParams(window.location.search).get('checkout');
		if (checkoutStatus === 'success') {
			checkoutNotice = 'Payment processing; credits appear after payment confirmation.';
			showRefreshBalance = true;
		} else if (checkoutStatus === 'canceled') {
			checkoutNotice = 'Checkout was canceled. No credits were added.';
		}
		void loadBillingSummary();
	});
</script>

<div class="min-h-screen bg-surface font-sans text-slate-900">
	<AppHeader backHref="/app" backLabel="Back to dashboard" />

	<main class="mx-auto max-w-3xl px-6 py-8">
		<h1 class="text-2xl font-bold text-slate-900">AI credits</h1>
		<p class="mt-1 text-sm text-slate-500">
			Manage your available credit and review recent activity.
		</p>

		{#if summary?.mode === 'test'}
			<p
				class="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
				role="status"
			>
				Test mode: payments and AI responses are simulated. No real AI credit is spent.
			</p>
		{/if}

		{#if checkoutNotice}
			<div
				class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800"
				role="status"
				aria-live="polite"
			>
				<span>{checkoutNotice}</span>
				{#if showRefreshBalance}
					<button
						type="button"
						onclick={loadBillingSummary}
						disabled={billingLoading}
						class="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-50"
					>
						{billingLoading ? 'Refreshing…' : 'Refresh balance'}
					</button>
				{/if}
			</div>
		{/if}

		{#if billingError}
			<div
				class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
				role="alert"
				aria-live="assertive"
			>
				<span>{billingError}</span>
				<button
					type="button"
					onclick={loadBillingSummary}
					disabled={billingLoading}
					class="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
				>
					Try again
				</button>
			</div>
		{/if}

		<section class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 class="text-base font-semibold text-slate-900">Available credit</h2>
					{#if billingLoading && !summary}
						<p class="mt-2 text-3xl font-bold text-slate-400" aria-label="Loading available credit">
							Loading…
						</p>
					{:else if summary}
						<p class="mt-2 text-3xl font-bold tracking-tight text-slate-900">
							{formatCredit(summary.balanceMicroUsd)}
						</p>
					{:else}
						<p class="mt-2 text-sm text-slate-500">Balance unavailable</p>
					{/if}
				</div>
				{#if summary && summary.heldMicroUsd > 0}
					<div class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
						<div class="font-medium">Pending hold</div>
						<div class="mt-1">{formatCredit(summary.heldMicroUsd)}</div>
						<p class="mt-1 max-w-xs text-xs text-amber-800">
							Unused funds return to your available credit after the request settles.
						</p>
					</div>
				{/if}
			</div>

			<p class="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
				AI requests cost 2× the provider cost. A temporary hold of up to $0.30 is settled against
				actual usage; unused funds return to your available credit.
			</p>

			<div class="mt-6 border-t border-slate-100 pt-5">
				<h3 class="text-sm font-semibold text-slate-900">Add credit</h3>
				{#if summary && !summary.checkoutEnabled}
					<p class="mt-1 text-sm text-slate-500">Purchases are currently unavailable.</p>
				{/if}
				<fieldset class="mt-3">
					<legend class="sr-only">Choose an AI credit top-up amount</legend>
					<div class="flex flex-wrap gap-2">
						{#each topupOptions as amountCents (amountCents)}
							<button
								type="button"
								aria-pressed={selectedAmountCents === amountCents}
								disabled={checkoutBusy || billingLoading || !summary?.checkoutEnabled}
								onclick={() => selectTopup(amountCents)}
								class="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 {selectedAmountCents ===
								amountCents
									? 'border-brand-600 bg-brand-50 text-brand-700'
									: 'border-slate-300 bg-white text-slate-700 hover:border-brand-300'}"
							>
								{usdFormatter.format(amountCents / 100)}
							</button>
						{/each}
					</div>
				</fieldset>
				<div class="mt-4 flex flex-wrap items-center gap-3">
					<button
						type="button"
						onclick={startCheckout}
						disabled={checkoutBusy || billingLoading || !summary?.checkoutEnabled}
						class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{checkoutBusy
							? 'Opening checkout…'
							: `Continue with ${usdFormatter.format(selectedAmountCents / 100)}`}
					</button>
					{#if checkoutError}
						<p class="text-sm text-red-700" role="alert" aria-live="assertive">{checkoutError}</p>
					{/if}
				</div>
			</div>
		</section>

		<section class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-base font-semibold text-slate-900">Recent activity</h2>
				{#if billingLoading && summary}
					<span class="text-xs text-slate-400" aria-live="polite">Refreshing…</span>
				{/if}
			</div>
			{#if !summary && billingLoading}
				<p class="mt-4 text-sm text-slate-500">Loading recent activity…</p>
			{:else if !summary}
				<p class="mt-4 text-sm text-slate-500">Recent activity is unavailable.</p>
			{:else if history.length === 0}
				<p class="mt-4 text-sm text-slate-500">No credit activity yet.</p>
			{:else}
				<ul class="mt-3 divide-y divide-slate-100">
					{#each history as entry (`${entry.kind}-${entry.id}`)}
						<li class="flex flex-wrap items-center justify-between gap-3 py-3">
							<div>
								{#if entry.kind === 'purchase'}
									<p class="text-sm font-medium text-slate-800">AI credit top-up</p>
									<p class="mt-0.5 text-xs text-slate-500">
										{formatDate(entry.createdAt)} · {usdFormatter.format(entry.amountCents / 100)} · {purchaseLabels[
											entry.status
										]}
									</p>
								{:else}
									<p class="text-sm font-medium text-slate-800">AI request</p>
									<p class="mt-0.5 text-xs text-slate-500">
										{formatDate(entry.createdAt)} · {entry.chargedMicroUsd === null
											? `Pending · up to ${formatCredit(entry.reservedMicroUsd)}`
											: 'Settled'}
									</p>
								{/if}
							</div>
							<span class="text-sm font-semibold text-slate-700 tabular-nums">
								{#if entry.kind === 'purchase'}
									+{formatCredit(entry.creditedMicroUsd)}
								{:else if entry.chargedMicroUsd === null}
									Pending
								{:else}
									−{formatCredit(entry.chargedMicroUsd)}
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>

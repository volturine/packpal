<script lang="ts">
	import type { ChatMessage, PackingItem, PackingItemPriority, Trip } from '$lib/types';

	const { data } = $props();
	const tripId = $derived(data.tripId);

	let trip = $state<Trip | null>(null);
	let items = $state<PackingItem[]>([]);
	let messages = $state<ChatMessage[]>([]);
	let hasMoreMessages = $state(false);
	let loadingOlder = $state(false);
	let loadError = $state(false);
	let loading = $state(true);
	let inputText = $state('');
	let streaming = $state(false);
	let streamedContent = $state('');
	let chatContainer: HTMLDivElement | undefined = $state();
	let actionFeedback = $state('');

	const displayMessages = $derived.by(() => {
		const currentMessages = messages.map((message) => ({
			role: message.role,
			content: message.content
		}));
		if (streaming && streamedContent) {
			currentMessages.push({ role: 'assistant' as const, content: streamedContent });
		}
		return currentMessages;
	});

	const parsedSuggestions = $derived.by(() => {
		const latestAssistantMessage = [...displayMessages]
			.reverse()
			.find((message) => message.role === 'assistant');
		if (!latestAssistantMessage) return [];
		return latestAssistantMessage.content
			.split('\n')
			.filter((line) => line.startsWith('ADD_ITEM:'))
			.map((line) => line.replace('ADD_ITEM:', '').trim())
			.map((line) => {
				const [name, category, priority, notes] = line.split('|').map((part) => part.trim());
				return {
					name,
					category: category || 'Travel Essentials',
					priority: (priority as PackingItemPriority) || 'normal',
					notes: notes || null
				};
			})
			.filter((suggestion) => suggestion.name);
	});

	const SUGGESTIONS = [
		'What am I missing for this trip?',
		'Which must-pack items should I handle first?',
		'Are there contradictions in my current list?',
		'What should I know about the destination and season?',
		'What can I remove if I want to pack lighter?'
	];

	function scrollToBottom() {
		if (!chatContainer) return;
		requestAnimationFrame(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		});
	}

	async function loadData() {
		loading = true;
		loadError = false;
		try {
			const [tripRes, itemsRes, messagesRes] = await Promise.all([
				fetch(`/api/trips/${tripId}`),
				fetch(`/api/packing-items?tripId=${tripId}`),
				fetch(`/api/chat-messages?tripId=${tripId}`)
			]);
			if (!tripRes.ok) {
				loadError = true;
				return;
			}
			trip = await tripRes.json();
			items = await itemsRes.json();
			const chatData = await messagesRes.json();
			messages = chatData.messages;
			hasMoreMessages = chatData.hasMore;
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	async function loadOlderMessages() {
		if (loadingOlder || !hasMoreMessages || messages.length === 0) return;
		loadingOlder = true;

		const oldestTimestamp = messages[0].createdAt;
		const prevScrollHeight = chatContainer?.scrollHeight ?? 0;

		try {
			const res = await fetch(`/api/chat-messages?tripId=${tripId}&before=${oldestTimestamp}`);
			if (!res.ok) return;
			const chatData = await res.json();
			messages = [...chatData.messages, ...messages];
			hasMoreMessages = chatData.hasMore;

			requestAnimationFrame(() => {
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight - prevScrollHeight;
				}
			});
		} finally {
			loadingOlder = false;
		}
	}

	function handleScroll() {
		if (!chatContainer || loadingOlder || !hasMoreMessages) return;
		if (chatContainer.scrollTop < 100) {
			loadOlderMessages();
		}
	}

	async function saveAssistantMessage(content: string) {
		const response = await fetch('/api/chat-messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tripId, role: 'assistant', content })
		});
		if (!response.ok) return;
		const { id } = await response.json();
		messages = [
			...messages,
			{ id, tripId, userId: '', role: 'assistant', content, createdAt: Date.now() }
		];
	}

	async function sendMessage(text?: string) {
		const content = (text ?? inputText).trim();
		if (!content || streaming || !trip) return;

		inputText = '';
		streaming = true;
		streamedContent = '';
		actionFeedback = '';

		const saveRes = await fetch('/api/chat-messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tripId, role: 'user', content })
		});
		if (saveRes.ok) {
			const { id } = await saveRes.json();
			messages = [
				...messages,
				{ id, tripId, userId: '', role: 'user', content, createdAt: Date.now() }
			];
		}

		const chatHistory = messages.map((message) => ({
			role: message.role,
			content: message.content
		}));
		const tripContext = {
			name: trip.name,
			destination: trip.destination,
			country: trip.country,
			climate: trip.climate,
			activities: trip.activities,
			startDate: trip.startDate,
			endDate: trip.endDate,
			travelers: trip.travelers,
			ownerDisplayName: trip.ownerDisplayName,
			contradictions: trip.contradictions,
			packingItems: items.map((item) => ({
				name: item.name,
				category: item.category,
				packed: item.packed,
				notes: item.notes,
				priority: item.priority
			}))
		};

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: chatHistory, tripContext })
			});

			if (!response.ok) {
				const errData = await response.json();
				streamedContent = `Error: ${errData.error ?? 'Failed to get response'}`;
				await saveAssistantMessage(streamedContent);
				streaming = false;
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) {
				streaming = false;
				return;
			}

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed.startsWith('data: ')) continue;
					const payload = trimmed.slice(6);
					if (payload === '[DONE]') continue;

					try {
						const parsed = JSON.parse(payload);
						if (parsed.content) {
							streamedContent += parsed.content;
							scrollToBottom();
						}
					} catch {
						// skip malformed JSON
					}
				}
			}

			if (streamedContent) await saveAssistantMessage(streamedContent);
		} catch (err) {
			streamedContent = `Error: ${err instanceof Error ? err.message : 'Network error'}`;
			await saveAssistantMessage(streamedContent);
		} finally {
			streaming = false;
			streamedContent = '';
		}
	}

	async function addSuggestedItem(suggestion: {
		name: string;
		category: string;
		priority: PackingItemPriority;
		notes: string | null;
	}) {
		const response = await fetch('/api/packing-items', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				tripId,
				item: {
					name: suggestion.name,
					category: suggestion.category,
					quantity: 1,
					notes: suggestion.notes ?? undefined,
					priority: suggestion.priority
				}
			})
		});
		if (!response.ok) return;
		const { id } = await response.json();
		items = [
			...items,
			{
				id,
				tripId,
				userId: '',
				name: suggestion.name,
				category: suggestion.category,
				packed: false,
				quantity: 1,
				isCustom: true,
				notes: suggestion.notes,
				priority: suggestion.priority
			}
		];
		actionFeedback = `Added ${suggestion.name} to your trip.`;
	}

	$effect(() => {
		loadData();
	});

	$effect(() => {
		if (displayMessages.length > 0) scrollToBottom();
	});
</script>

<div class="flex min-h-screen flex-col bg-surface font-sans text-slate-900">
	<header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
		<div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
			<a
				href="/app/trips/{tripId}"
				class="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
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
				Back to trip
			</a>
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-slate-700">{trip ? trip.name : 'Loading...'}</span
				><span
					class="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs text-white"
					>AI</span
				>
			</div>
			<div></div>
		</div>
	</header>

	{#if loadError}
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
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
		</div>
	{:else if loading}
		<div class="flex flex-1 items-center justify-center">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
			></div>
		</div>
	{:else}
		<div bind:this={chatContainer} onscroll={handleScroll} class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-4xl px-6 py-6">
				{#if hasMoreMessages}
					<div class="mb-4 text-center">
						<button
							onclick={loadOlderMessages}
							disabled={loadingOlder}
							class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
						>
							{loadingOlder ? 'Loading...' : 'Load older messages'}
						</button>
					</div>
				{/if}

				{#if trip}
					<div class="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<div class="grid gap-3 md:grid-cols-2">
							<div>
								<div class="text-sm font-semibold text-slate-900">Trip brief</div>
								<p class="mt-1 text-sm text-slate-500">
									{trip.destination}{trip.country ? `, ${trip.country}` : ''} • {trip.climate} • {trip.travelers}
									traveler{trip.travelers === 1 ? '' : 's'}
								</p>
								<p class="mt-2 text-xs text-slate-500">
									{trip.packedCount ?? 0}/{trip.itemCount ?? 0} packed • {trip.criticalUnpackedCount ??
										0} critical unpacked
								</p>
							</div>
							<div>
								<div class="text-sm font-semibold text-slate-900">Known warnings</div>
								{#if trip.contradictions?.length}
									<ul class="mt-1 space-y-1 text-xs text-amber-700">
										{#each trip.contradictions as contradiction (contradiction.message)}<li>
												{contradiction.message}
											</li>{/each}
									</ul>
								{:else}
									<p class="mt-1 text-xs text-slate-500">No contradictions detected right now.</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				{#if displayMessages.length === 0}
					<div class="py-12 text-center">
						<div
							class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl"
						>
							&#x1F9F3;
						</div>
						<h2 class="text-lg font-semibold text-slate-900">PackPal AI Assistant</h2>
						<p class="mx-auto mt-2 max-w-md text-sm text-slate-500">
							Ask for missing items, contradiction checks, lighter packing advice, or
							destination-specific prep.
						</p>
						<div class="mt-6 flex flex-wrap justify-center gap-2">
							{#each SUGGESTIONS as suggestion (suggestion)}
								<button
									onclick={() => sendMessage(suggestion)}
									class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50"
									>{suggestion}</button
								>
							{/each}
						</div>
					</div>
				{:else}
					<div class="space-y-4">
						{#each displayMessages as message, index (index)}
							{#if message.role === 'user'}
								<div class="flex justify-end">
									<div
										class="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white"
									>
										{message.content}
									</div>
								</div>
							{:else}
								<div class="flex justify-start">
									<div class="flex max-w-[85%] gap-2.5">
										<div
											class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700"
										>
											AI
										</div>
										<div
											class="rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm"
										>
											<div class="whitespace-pre-wrap">{message.content}</div>
											{#if streaming && index === displayMessages.length - 1}<span
													class="inline-block h-4 w-1 animate-pulse bg-brand-600"
												></span>{/if}
										</div>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				{#if parsedSuggestions.length > 0}
					<div class="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<div class="text-sm font-semibold text-slate-900">Suggested actions</div>
						<div class="mt-3 space-y-2">
							{#each parsedSuggestions as suggestion (suggestion.name + suggestion.category + suggestion.priority)}
								<div
									class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm"
								>
									<div>
										<div class="font-medium text-slate-800">{suggestion.name}</div>
										<div class="text-xs text-slate-500">
											{suggestion.category} • {suggestion.priority}{suggestion.notes
												? ` • ${suggestion.notes}`
												: ''}
										</div>
									</div>
									<button
										onclick={() => addSuggestedItem(suggestion)}
										class="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white"
										>Add this item</button
									>
								</div>
							{/each}
						</div>
						{#if actionFeedback}<p class="mt-3 text-sm text-emerald-600">{actionFeedback}</p>{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
			<div class="mx-auto max-w-4xl">
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={inputText}
						placeholder={streaming ? 'Thinking...' : 'Ask about your trip...'}
						disabled={streaming || !trip}
						onkeydown={(event: KeyboardEvent) => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault();
								sendMessage();
							}
						}}
						class="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
					/>
					<button
						onclick={() => sendMessage()}
						disabled={!inputText.trim() || streaming || !trip}
						class="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
						>{streaming ? '...' : 'Send'}</button
					>
				</div>
				<p class="mt-2 text-center text-xs text-slate-400">
					AI suggestions are for guidance only. Always verify travel requirements independently.
				</p>
			</div>
		</div>
	{/if}
</div>

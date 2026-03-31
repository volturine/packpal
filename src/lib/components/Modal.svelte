<script lang="ts">
	interface Props {
		open: boolean;
		title: string;
		description?: string;
		onclose: () => void;
		children: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	}

	const { open, title, description, onclose, children, footer }: Props = $props();
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div class="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
			<div class="sticky top-0 border-b border-slate-200 bg-white px-6 py-4">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 id="modal-title" class="text-base font-semibold text-slate-900">
							{title}
						</h2>
						{#if description}
							<p class="text-sm text-slate-500">{description}</p>
						{/if}
					</div>
					<button
						onclick={onclose}
						class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						aria-label="Close"
					>
						Close
					</button>
				</div>
			</div>

			<div class="p-6">
				{@render children()}
			</div>

			{#if footer}
				<div class="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

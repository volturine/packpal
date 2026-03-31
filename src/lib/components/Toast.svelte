<script lang="ts">
	interface ToastData {
		message: string;
		undoLabel?: string;
		action?: () => Promise<void> | void;
	}

	interface Props {
		toast: ToastData | null;
	}

	const { toast }: Props = $props();
</script>

{#if toast}
	<div
		class="fixed right-4 bottom-4 z-50 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
	>
		<div class="flex items-center gap-3 text-sm text-slate-700">
			<span>{toast.message}</span>
			{#if toast.action}
				<button
					onclick={() => toast?.action?.()}
					class="font-semibold text-brand-600 hover:text-brand-700"
					>{toast.undoLabel ?? 'Undo'}</button
				>
			{/if}
		</div>
	</div>
{/if}

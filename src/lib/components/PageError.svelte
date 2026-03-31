<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';

	const { error }: { error: unknown } = $props();

	const parsedError = $derived.by((): App.Error => {
		if (isHttpError(error)) {
			return error.body;
		}

		console.error(error);

		return {
			message: 'Unknown error',
			kind: 'UnknownError',
			timestamp: Date.now()
		};
	});
</script>

<div>
	<h1>{parsedError.message}</h1>
	<p>{parsedError.kind}</p>
	<p>{parsedError.timestamp}</p>
	{#if parsedError.traceId}
		<p>send to support if you see this: {parsedError.traceId}</p>
	{/if}
</div>

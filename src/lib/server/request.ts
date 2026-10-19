const DEFAULT_MAX_JSON_BYTES = 16_384;

/** Read a bounded JSON object from a request body. */
export async function readJsonObject(
	request: Request,
	maxBytes = DEFAULT_MAX_JSON_BYTES
): Promise<Record<string, unknown> | null> {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) return null;

	const reader = request.body?.getReader();
	if (!reader) return null;

	const chunks: Uint8Array[] = [];
	let byteLength = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			byteLength += value.byteLength;
			if (byteLength > maxBytes) {
				await reader.cancel();
				return null;
			}
			chunks.push(value);
		}
	} catch {
		return null;
	} finally {
		reader.releaseLock();
	}

	const bytes = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	try {
		const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
		return value as Record<string, unknown>;
	} catch {
		return null;
	}
}

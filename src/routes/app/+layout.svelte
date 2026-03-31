<script lang="ts">
	import type { AuthUser } from '$lib/types';
	import { setContext } from 'svelte';

	const { children } = $props();

	let user = $state<AuthUser | null>(null);
	let loading = $state(true);

	// Auth form state
	let isLogin = $state(true);
	let username = $state('');
	let password = $state('');
	let displayName = $state('');
	let authError = $state('');
	let authSubmitting = $state(false);

	const authContext = {
		get user() {
			return user;
		},
		logout: async () => {
			await fetch('/api/auth/logout', { method: 'POST' });
			user = null;
			isLogin = true;
			authError = '';
		}
	};

	setContext('auth', authContext);

	async function checkAuth() {
		try {
			const res = await fetch('/api/auth/me');
			const data = await res.json();
			user = data.user;
		} catch {
			user = null;
		} finally {
			loading = false;
		}
	}

	async function handleAuth() {
		if (authSubmitting) return;
		authSubmitting = true;
		authError = '';

		try {
			const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
			const body = isLogin
				? { username: username.trim(), password }
				: {
						username: username.trim(),
						password,
						displayName: displayName.trim() || username.trim()
					};

			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const data = await res.json();
			if (!res.ok) {
				authError = data.error ?? 'Authentication failed';
				return;
			}

			user = data.user;
			username = '';
			password = '';
			displayName = '';
		} catch {
			authError = 'Network error';
		} finally {
			authSubmitting = false;
		}
	}

	$effect(() => {
		checkAuth();
	});
</script>

<svelte:head>
	<title>PackPal - Smart Packing Lists</title>
</svelte:head>

{#if loading}
	<div class="flex min-h-screen items-center justify-center bg-surface">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
		></div>
	</div>
{:else if !user}
	<div class="flex min-h-screen items-center justify-center bg-surface">
		<div class="w-full max-w-md px-6">
			<div class="mb-8 text-center">
				<a href="/" class="inline-flex items-center gap-2 text-2xl font-bold text-slate-900">
					<span
						class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm text-white"
						>P</span
					>
					PackPal
				</a>
				<p class="mt-2 text-sm text-slate-500">
					{isLogin ? 'Sign in to start packing smarter' : 'Create your account'}
				</p>
			</div>

			{#if authError}
				<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					{authError}
				</div>
			{/if}

			<form
				onsubmit={(e: SubmitEvent) => {
					e.preventDefault();
					handleAuth();
				}}
				class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
			>
				<div>
					<label for="username" class="mb-1 block text-sm font-medium text-slate-700"
						>Username</label
					>
					<input
						id="username"
						type="text"
						bind:value={username}
						placeholder="Enter username"
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					/>
				</div>

				{#if !isLogin}
					<div>
						<label for="display-name" class="mb-1 block text-sm font-medium text-slate-700">
							Display Name <span class="text-slate-400">(optional)</span>
						</label>
						<input
							id="display-name"
							type="text"
							bind:value={displayName}
							placeholder="Your name"
							class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
						/>
					</div>
				{/if}

				<div>
					<label for="password" class="mb-1 block text-sm font-medium text-slate-700"
						>Password</label
					>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="Enter password"
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					/>
				</div>

				<button
					type="submit"
					disabled={authSubmitting || !username.trim() || !password}
					class="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{#if authSubmitting}
						<span class="inline-flex items-center gap-2">
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
							></span>
							{isLogin ? 'Signing in...' : 'Creating account...'}
						</span>
					{:else}
						{isLogin ? 'Sign In' : 'Create Account'}
					{/if}
				</button>
			</form>

			<p class="mt-4 text-center text-sm text-slate-500">
				{isLogin ? "Don't have an account?" : 'Already have an account?'}
				<button
					type="button"
					onclick={() => {
						isLogin = !isLogin;
						authError = '';
					}}
					class="ml-1 font-medium text-brand-600 hover:text-brand-700"
				>
					{isLogin ? 'Sign up' : 'Sign in'}
				</button>
			</p>
		</div>
	</div>
{:else}
	{@render children()}
{/if}

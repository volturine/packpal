<script lang="ts">
	import { getContext } from 'svelte';
	import Toast from '$lib/components/Toast.svelte';
	import type { AuthUser } from '$lib/types';

	const auth = getContext<{
		user: AuthUser | null;
		logout: () => Promise<void>;
		updateUser?: (updated: AuthUser) => void;
	}>('auth');

	let displayName = $state(auth.user?.displayName ?? '');
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let profileSaving = $state(false);
	let passwordSaving = $state(false);

	let toast = $state<{ message: string } | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | undefined;

	function showToast(message: string) {
		clearTimeout(toastTimeout);
		toast = { message };
		toastTimeout = setTimeout(() => (toast = null), 3000);
	}

	async function saveDisplayName() {
		const trimmed = displayName.trim();
		if (!trimmed || trimmed === auth.user?.displayName) return;

		profileSaving = true;
		try {
			const res = await fetch('/api/auth/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ displayName: trimmed })
			});
			const data = await res.json();
			if (!res.ok) {
				showToast(data.error ?? 'Failed to update profile');
				return;
			}
			if (auth.updateUser) auth.updateUser(data.user);
			showToast('Display name updated');
		} catch {
			showToast('Network error');
		} finally {
			profileSaving = false;
		}
	}

	async function changePassword() {
		if (!currentPassword || !newPassword) return;
		if (newPassword !== confirmPassword) {
			showToast('New passwords do not match');
			return;
		}
		if (newPassword.length < 6) {
			showToast('New password must be at least 6 characters');
			return;
		}

		passwordSaving = true;
		try {
			const res = await fetch('/api/auth/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword })
			});
			const data = await res.json();
			if (!res.ok) {
				showToast(data.error ?? 'Failed to change password');
				return;
			}
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			showToast('Password changed successfully');
		} catch {
			showToast('Network error');
		} finally {
			passwordSaving = false;
		}
	}

	const displayNameChanged = $derived(
		displayName.trim() !== '' && displayName.trim() !== auth.user?.displayName
	);
	const passwordFormValid = $derived(
		currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword
	);
</script>

<div class="min-h-screen bg-surface font-sans text-slate-900">
	<header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
			<a href="/app" class="flex items-center gap-2 text-lg font-bold tracking-tight">
				<span
					class="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs text-white"
					>P</span
				>
				PackPal
			</a>
			<div class="flex items-center gap-3">
				<a
					href="/app"
					class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
				>
					Back to Dashboard
				</a>
				<button
					onclick={auth.logout}
					class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
				>
					Sign out
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-2xl px-6 py-8">
		<h1 class="text-2xl font-bold text-slate-900">Profile Settings</h1>
		<p class="mt-1 text-sm text-slate-500">Manage your account details.</p>

		<section class="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="text-base font-semibold text-slate-900">Account Info</h2>
			<div class="mt-4 space-y-4">
				<div>
					<label for="username" class="mb-1 block text-sm font-medium text-slate-700"
						>Username</label
					>
					<input
						id="username"
						type="text"
						value={auth.user?.username ?? ''}
						disabled
						class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
					/>
					<p class="mt-1 text-xs text-slate-400">Username cannot be changed.</p>
				</div>
				<div>
					<label for="displayName" class="mb-1 block text-sm font-medium text-slate-700"
						>Display Name</label
					>
					<input
						id="displayName"
						type="text"
						bind:value={displayName}
						placeholder="Your display name"
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					/>
				</div>
				<div class="flex justify-end">
					<button
						onclick={saveDisplayName}
						disabled={!displayNameChanged || profileSaving}
						class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{profileSaving ? 'Saving...' : 'Save Display Name'}
					</button>
				</div>
			</div>
		</section>

		<section class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="text-base font-semibold text-slate-900">Change Password</h2>
			<form
				onsubmit={(e: SubmitEvent) => {
					e.preventDefault();
					changePassword();
				}}
				class="mt-4 space-y-4"
			>
				<div>
					<label for="currentPassword" class="mb-1 block text-sm font-medium text-slate-700"
						>Current Password</label
					>
					<input
						id="currentPassword"
						type="password"
						bind:value={currentPassword}
						placeholder="Enter current password"
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					/>
				</div>
				<div>
					<label for="newPassword" class="mb-1 block text-sm font-medium text-slate-700"
						>New Password</label
					>
					<input
						id="newPassword"
						type="password"
						bind:value={newPassword}
						placeholder="At least 6 characters"
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					/>
				</div>
				<div>
					<label for="confirmPassword" class="mb-1 block text-sm font-medium text-slate-700"
						>Confirm New Password</label
					>
					<input
						id="confirmPassword"
						type="password"
						bind:value={confirmPassword}
						placeholder="Re-enter new password"
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
					/>
					{#if confirmPassword && newPassword !== confirmPassword}
						<p class="mt-1 text-xs text-red-600">Passwords do not match.</p>
					{/if}
				</div>
				<div class="flex justify-end">
					<button
						type="submit"
						disabled={!passwordFormValid || passwordSaving}
						class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{passwordSaving ? 'Changing...' : 'Change Password'}
					</button>
				</div>
			</form>
		</section>
	</main>
</div>

<Toast {toast} />

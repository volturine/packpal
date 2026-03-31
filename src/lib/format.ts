import type { ReminderSummary } from '$lib/types';

export function formatDate(ts: number): string {
	return new Date(ts).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

export function daysUntil(ts: number): string {
	const diff = ts - Date.now();
	const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
	if (days < 0) return `${Math.abs(days)} days ago`;
	if (days === 0) return 'Today!';
	if (days === 1) return 'Tomorrow!';
	return `${days} days to go`;
}

export function toDateInputValue(ts: number): string {
	return new Date(ts).toISOString().slice(0, 10);
}

export function reminderClasses(tone: ReminderSummary['tone']): string {
	if (tone === 'urgent') return 'border-red-200 bg-red-50 text-red-700';
	if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
	return 'border-slate-200 bg-slate-50 text-slate-600';
}

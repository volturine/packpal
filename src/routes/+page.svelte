<script lang="ts" module>
	const activityNames = [
		'Beach Vacation',
		'Hiking',
		'Camping',
		'Skiing',
		'Snowboarding',
		'Scuba Diving',
		'Snorkeling',
		'Surfing',
		'Kayaking',
		'Sailing',
		'Cruise',
		'City Break',
		'Business Trip',
		'Wedding',
		'Music Festival',
		'Safari',
		'Rock Climbing',
		'Cycling',
		'Fishing',
		'Photography',
		'Yoga Retreat',
		'Spa & Wellness',
		'Golf',
		'Backpacking',
		'Road Trip',
		'Digital Nomad',
		'Solo Travel',
		'Family Vacation',
		'Honeymoon',
		'Study Abroad',
		'Volunteering',
		'Food Tour',
		'Nightlife',
		'Horseback Riding',
		'Snowshoeing',
		'Ice Skating'
	];
</script>

<script lang="ts">
</script>

<svelte:head>
	<title>PackPal - Pack perfectly for every trip</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
	<nav class="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a href="/" class="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm text-white"
					>P</span
				>
				PackPal
			</a>
			<div class="flex items-center gap-4">
				<a
					href="/app"
					class="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
				>
					Get Started
				</a>
			</div>
		</div>
	</nav>

	<section class="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center">
		<div
			class="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700"
		>
			Never forget anything again
		</div>
		<h1
			class="mx-auto max-w-4xl text-5xl leading-tight font-extrabold tracking-tight text-slate-900 sm:text-6xl sm:leading-tight"
		>
			Pack perfectly for
			<span class="bg-gradient-to-r from-brand-600 to-blue-500 bg-clip-text text-transparent">
				every trip
			</span>
		</h1>
		<p class="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
			Smart packing lists for 35+ activities, from beach vacations to business trips. AI-powered
			suggestions, climate-aware recommendations, and a checklist that makes sure nothing gets left
			behind.
		</p>
		<div class="mt-10 flex justify-center gap-4">
			<a
				href="/app"
				class="rounded-lg bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl"
			>
				Start Packing
			</a>
			<a
				href="#features"
				class="rounded-lg border border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
			>
				See Features
			</a>
		</div>
	</section>

	<section id="features" class="mx-auto max-w-6xl px-6 py-20">
		<div class="mb-16 text-center">
			<h2 class="text-3xl font-bold tracking-tight text-slate-900">
				Everything you need to pack right
			</h2>
			<p class="mt-4 text-lg text-slate-600">
				Built by travelers, for travelers. Every feature exists because someone forgot something
				important.
			</p>
		</div>

		<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div
					class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl"
				>
					&#x1F3AF;
				</div>
				<h3 class="text-lg font-semibold text-slate-900">35+ Activity Templates</h3>
				<p class="mt-2 text-sm leading-relaxed text-slate-600">
					Pre-built packing lists for hiking, skiing, beach, business, camping, festivals, scuba
					diving, and dozens more. Every item curated by experienced travelers.
				</p>
			</div>

			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div
					class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-2xl"
				>
					&#x2600;
				</div>
				<h3 class="text-lg font-semibold text-slate-900">Climate-Aware Packing</h3>
				<p class="mt-2 text-sm leading-relaxed text-slate-600">
					Tell us the climate and we adjust everything. Tropical, cold, arid, temperate, or mixed --
					the right gear for the right weather.
				</p>
			</div>

			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div
					class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-2xl"
				>
					&#x1F916;
				</div>
				<h3 class="text-lg font-semibold text-slate-900">AI Packing Assistant</h3>
				<p class="mt-2 text-sm leading-relaxed text-slate-600">
					Not sure what to bring? Chat with our AI assistant for personalized suggestions based on
					your destination, duration, and activities.
				</p>
			</div>

			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div
					class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-2xl"
				>
					&#x2705;
				</div>
				<h3 class="text-lg font-semibold text-slate-900">Interactive Checklists</h3>
				<p class="mt-2 text-sm leading-relaxed text-slate-600">
					Check items off as you pack. See your progress at a glance by category. Toggle entire
					categories at once. Never second-guess yourself.
				</p>
			</div>

			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div
					class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-2xl"
				>
					&#x2795;
				</div>
				<h3 class="text-lg font-semibold text-slate-900">Fully Customizable</h3>
				<p class="mt-2 text-sm leading-relaxed text-slate-600">
					Add your own items, adjust quantities, add notes. Every packing list is a starting point
					you can make your own.
				</p>
			</div>

			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div
					class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-2xl"
				>
					&#x1F310;
				</div>
				<h3 class="text-lg font-semibold text-slate-900">Multi-Activity Trips</h3>
				<p class="mt-2 text-sm leading-relaxed text-slate-600">
					Combining hiking with city sightseeing? Beach then a wedding? Select multiple activities
					and get one smart, deduplicated packing list.
				</p>
			</div>
		</div>
	</section>

	<section class="border-t border-slate-200 bg-slate-50 py-20">
		<div class="mx-auto max-w-6xl px-6">
			<div class="mb-12 text-center">
				<h2 class="text-3xl font-bold tracking-tight text-slate-900">Activities we cover</h2>
				<p class="mt-4 text-lg text-slate-600">And this is just the start. We keep adding more.</p>
			</div>
			<div class="flex flex-wrap justify-center gap-3">
				{#each activityNames as name (name)}
					<span
						class="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700"
					>
						{name}
					</span>
				{/each}
			</div>
		</div>
	</section>

	<section class="py-20">
		<div class="mx-auto max-w-3xl px-6 text-center">
			<h2 class="text-3xl font-bold tracking-tight text-slate-900">Ready to pack smarter?</h2>
			<p class="mt-4 text-lg text-slate-600">
				Create your free account and never forget a thing on your next trip.
			</p>
			<a
				href="/app"
				class="mt-8 inline-block rounded-lg bg-brand-600 px-10 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl"
			>
				Get Started -- It's Free
			</a>
		</div>
	</section>

	<footer class="border-t border-slate-200 bg-white py-8">
		<div class="mx-auto max-w-6xl px-6 text-center text-sm text-slate-500">
			PackPal &middot; Pack perfectly, travel confidently.
		</div>
	</footer>
</div>

// ---------------------------------------------------------------------------
// Minimal shape interfaces for href builders.
//
// Pages often construct ad-hoc objects like `{ id: city.id, slug: city.slug }`
// so these must be loose — only requiring `id` and optionally `slug` / `url`.
// ---------------------------------------------------------------------------

/** Anything with an id, optional slug and optional url. */
interface Linkable {
	id: string | null;
	slug?: string | null;
	url?: string | null;
	country_slug?: string | null;
	country_url?: string | null;
}

/** Tag-like objects additionally carry tag_slug. */
interface TagLinkable extends Linkable {
	tag_slug?: string | null;
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function urlLastSegment(url: string | null | undefined): string | null {
	if (!url) return null;

	try {
		const parsed = new URL(url);
		const segments = parsed.pathname.split("/").filter(Boolean);
		return segments.at(-1) ?? null;
	} catch {
		const segments = String(url).split("/").filter(Boolean);
		return segments.at(-1) ?? null;
	}
}

function pathPart(value: string | null | undefined): string {
	return encodeURIComponent(String(value ?? "").trim());
}

// ---------------------------------------------------------------------------
// Slug resolvers
// ---------------------------------------------------------------------------

function resolveSlug(item: Linkable): string {
	return item.slug || urlLastSegment(item.url) || item.id || "";
}

function resolveTagSlug(tag: TagLinkable): string {
	return tag.tag_slug || tag.slug || urlLastSegment(tag.url) || tag.id || "";
}

function resolveCountrySlug(item: Linkable): string | null {
	return item.country_slug || urlLastSegment(item.country_url);
}

// ---------------------------------------------------------------------------
// Public href builders
// ---------------------------------------------------------------------------

export function countryHref(country: Linkable): string {
	return `/${pathPart(resolveSlug(country))}`;
}

export function cityHref(city: Linkable): string {
	const citySlug = pathPart(resolveSlug(city));
	const countrySlug = resolveCountrySlug(city);

	return countrySlug ? `/${pathPart(countrySlug)}/${citySlug}` : `/${citySlug}`;
}

export function cityCategoryHref(city: Linkable, tag: TagLinkable): string {
	return `${cityHref(city)}/${pathPart(resolveTagSlug(tag))}`;
}

export function experienceHref(experience: (Linkable & { city_slug?: string | null }) | null | undefined): string {
	if (!experience) return "";

	const slug = experience.slug?.trim();

	const citySlug = experience.city_slug;
	const countrySlug = experience.country_slug;

	if (citySlug && countrySlug) {
		return `/${pathPart(countrySlug)}/${pathPart(citySlug)}/excursions/${pathPart(slug)}`;
	}

	return `/excursions/${pathPart(slug)}`;
}

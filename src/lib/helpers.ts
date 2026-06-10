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

function slugify(text: string | null | undefined): string {
	if (!text) return "";

	const ru: Record<string, string> = {
		'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
		'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
		'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
		'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
		'я': 'ya'
	};

	return String(text)
		.toLowerCase()
		.trim()
		.replace(/[а-яё]/g, (char) => ru[char] ?? char)
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/[\s-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function experienceHref(experience: any): string {
	if (!experience) return "";

	const id = experience.id;
	const title = experience.title;
	const slug = title ? slugify(title) : "";

	const citySlug = experience.city_slug;
	const countrySlug = experience.country_slug;

	if (citySlug && countrySlug) {
		return `/${pathPart(countrySlug)}/${pathPart(citySlug)}/excursions/${pathPart(id)}${slug ? "-" + slug : ""}`;
	}

	return `/excursions/${pathPart(id)}${slug ? "-" + slug : ""}`;
}

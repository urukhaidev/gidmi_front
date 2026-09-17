// ---------------------------------------------------------------------------
// Reusable SQL expression fragments.
//
// Each helper is a plain function that returns a raw SQL string.  The alias
// parameter defaults to the conventional alias used in most queries so callers
// can omit it in the common case.
// ---------------------------------------------------------------------------

/** Resolved display name: name_ru → name_en → fallback with id. */
export const displayName = (alias: string, fallback: string): string =>
	`coalesce(nullif(${alias}.name_ru, ''), nullif(${alias}.name_en, ''), '${fallback} ' || ${alias}.id::text)`;

/** Resolved name without a fallback (returns NULL when both are empty). */
export const displayNameShort = (alias: string): string =>
	`coalesce(nullif(${alias}.name_ru, ''), nullif(${alias}.name_en, ''))`;

/** Extract the last URL path segment as a slug. */
export const slugFromUrl = (alias: string): string =>
	`regexp_replace(trim(trailing '/' from ${alias}.url), '^.*/', '')`;

/** Public route slug for countries: prefer local Russian slug, keep Tripster URL as fallback. */
export const countrySlug = (alias: string): string =>
	`coalesce(nullif(${alias}.page_slug, ''), nullif(${slugFromUrl(alias)}, ''))`;

/** Public route slug for cities: prefer local Russian slug, keep Tripster slug/URL as fallback. */
export const citySlug = (alias: string): string =>
	`coalesce(nullif(${alias}.page_slug, ''), nullif(${alias}.slug, ''), nullif(${slugFromUrl(alias)}, ''))`;

// ---------------------------------------------------------------------------
// Column lists — one function per entity, returning a comma-separated string
// of aliased columns ready to drop into a SELECT clause.
// ---------------------------------------------------------------------------

export const countryColumns = (alias = "c"): string => `
	${alias}.id::text as id,
	${displayName(alias, "Страна")} as name,
	${alias}.name_en,
	${alias}.url,
	${countrySlug(alias)} as slug,
	${alias}.cover_image_url as image_url,
	${alias}.region,
	${alias}.currency,
	${alias}.about_obj_phrase,
	${alias}.in_obj_phrase,
	coalesce(${alias}.guides_count, 0)::int as guides_count,
	coalesce(${alias}.experience_count, 0)::int as experience_count`;

export const cityColumns = (alias = "c"): string => `
	${alias}.id::text as id,
	${displayName(alias, "Город")} as name,
	${alias}.name_en,
	${citySlug(alias)} as slug,
	${alias}.url,
	${alias}.image_cover as image_url,
	${alias}.image_thumbnail,
	${alias}.country_id::text as country_id,
	country.url as country_url,
	${countrySlug("country")} as country_slug,
	${alias}.about_obj_phrase,
	${alias}.in_obj_phrase,
	${alias}.across_obj_phrase,
	coalesce(${alias}.guides_count, 0)::int as guides_count,
	coalesce(${alias}.experience_count, 0)::int as experience_count`;

export const tagColumns = (
	categoryAlias = "cat",
	experienceCount = "0",
): string => `
	${categoryAlias}.id::text as id,
	${categoryAlias}.sub_name as name,
	${categoryAlias}.sub_slug as slug,
	${categoryAlias}.sub_slug as tag_slug,
	${categoryAlias}.main_name as category,
	${categoryAlias}.sub_name as tag_category,
	${categoryAlias}.main_name as group_name,
	${categoryAlias}.sub_name as term_name,
	${categoryAlias}.title,
	${categoryAlias}.header,
	${categoryAlias}.seo_description,
	${categoryAlias}.seo_text,
	${categoryAlias}.main_slug as group_slug,
	${categoryAlias}.sub_slug as term_slug,
	null::text as url,
	null::text as image_url,
	city.id::text as city_id,
	${citySlug("city")} as city_slug,
	${displayNameShort("city")} as city_name,
	country.url as country_url,
	${countrySlug("country")} as country_slug,
	coalesce(${experienceCount}, 0)::int as experience_count`;

export const experienceColumns = `
	e.id::text as id,
	e.title,
	e.tagline,
	e.annotation,
	e.url,
	coalesce(cover.photo_url, e.cover_image_url) as image_url,
	e.cover_image_url,
	e.price_value,
	e.price_currency,
	e.price_value_string,
	e.rating,
	e.review_count,
	e.duration,
	e.max_persons,
	e.type,
	e.format,
	e.movement_type,
	e.schedule_type,
	e.additional_info,
	e.comfort_level_info,
	e.price_included_description,
	e.price_not_included_description,
	e.description_html,
	e.description_new_html,
	e.meeting_point_text,
	e.finish_point_text,
	e.schedule_text,
	e.languages,
	e.city_id::text as city_id,
	e.country_id::text as country_id,
	e.guide_id::text as guide_id,
	${citySlug("city")} as city_slug,
	country.url as country_url,
	${countrySlug("country")} as country_slug,
	${displayNameShort("city")} as city_name,
	city.in_obj_phrase as city_in_obj_phrase,
	${displayNameShort("country")} as country_name,
	guide.first_name as guide_name,
	guide.avatar_medium as guide_avatar,
	guide.rating as guide_rating,
	guide.review_count as guide_review_count`;

export const experienceCardColumns = `
	e.id::text as id,
	e.title,
	e.tagline,
	e.url,
	coalesce(cover.photo_url, e.cover_image_url) as image_url,
	e.cover_image_url,
	e.price_value,
	e.price_currency,
	e.price_value_string,
	e.rating,
	e.review_count,
	e.duration,
	e.type,
	e.format,
	e.movement_type,
	e.city_id::text as city_id,
	e.country_id::text as country_id,
	${citySlug("city")} as city_slug,
	country.url as country_url,
	${countrySlug("country")} as country_slug,
	${displayNameShort("city")} as city_name,
	city.in_obj_phrase as city_in_obj_phrase,
	${displayNameShort("country")} as country_name`;

export const experienceJoins = `
	left join cities city on city.id = e.city_id
	left join countries country on country.id = e.country_id
	left join guides guide on guide.id = e.guide_id
	left join lateral (
		select p.thumbnail_url as photo_url
		from experience_photos p
		where p.experience_id = e.id
			and p.thumbnail_url is not null
		order by p.position asc
		limit 1
	) cover on true`;

export const experienceCardJoins = `
	left join cities city on city.id = e.city_id
	left join countries country on country.id = e.country_id
	left join lateral (
		select p.thumbnail_url as photo_url
		from experience_photos p
		where p.experience_id = e.id
			and p.thumbnail_url is not null
		order by p.position asc
		limit 1
	) cover on true`;

// ---------------------------------------------------------------------------
// ORDER BY helpers
// ---------------------------------------------------------------------------

export function experienceOrderBy(sort?: string): string {
	switch (sort) {
		case "rating":
			return `
				e.rating desc nulls last,
				e.review_count desc nulls last,
				e.visitors_count desc nulls last,
				e.id desc`;
		case "price_asc":
			return `
				e.price_value asc nulls last,
				e.rating desc nulls last,
				e.review_count desc nulls last,
				e.id desc`;
		case "price_desc":
			return `
				e.price_value desc nulls last,
				e.rating desc nulls last,
				e.review_count desc nulls last,
				e.id desc`;
		default:
			return `
				e.rating desc nulls last,
				e.review_count desc nulls last,
				e.visitors_count desc nulls last,
				e.id desc`;
	}
}

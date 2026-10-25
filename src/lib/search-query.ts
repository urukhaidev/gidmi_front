import { query } from "./db.js";
import { citySlug, countrySlug, displayName } from "./sql-fragments.js";
import type { QueryResult, SearchResultRow } from "./travel-types.js";

export async function searchTravel(
	queryText: string | null | undefined,
	limit = 18,
	scope: "all" | "destinations" = "all",
): Promise<QueryResult<SearchResultRow>> {
	const normalized = queryText?.trim();

	if (!normalized || normalized.length < 2) {
		return { rows: [], error: null };
	}

	const pattern = `%${normalized}%`;
	const countrySearchText = "(coalesce(c.name_ru, '') || ' ' || coalesce(c.name_en, ''))";
	const citySearchText = "(coalesce(c.name_ru, '') || ' ' || coalesce(c.name_en, ''))";
	const experienceSearchText = "e.title";

	return query<SearchResultRow>(
		`
		with matching_categories as materialized (
			select id, sub_name, sub_slug
			from tag_category_catalog cat
			where $3::boolean and (cat.main_name ilike $1
				or cat.sub_name ilike $1
				or cat.title ilike $1
				or cat.header ilike $1
				or cat.main_slug ilike $1
				or cat.sub_slug ilike $1
				or array_to_string(cat.lexical_triggers, ' ') ilike $1)
		), matching_tags as materialized (
			select etn.catalog_id, etn.experience_id
			from matching_categories cat
			join experience_tags_new etn on etn.catalog_id = cat.id
		), category_counts as (
			select etn.catalog_id as id, e.city_id, count(*)::int as count
			from matching_tags etn
			join experiences e on e.id = etn.experience_id
			join cities city on city.id = e.city_id
			group by etn.catalog_id, e.city_id
		), ranked_categories as (
			select cat.*, counts.city_id, counts.count
			from category_counts counts
			join matching_categories cat on cat.id = counts.id
			order by counts.count desc, cat.sub_name asc
			limit $2
		)
		select * from (
			select
				'country' as type,
				c.id::text as id,
				null::text as slug,
				${displayName("c", "Страна")} as title,
				'/' || coalesce(nullif(${countrySlug("c")}, ''), c.id::text) as url,
				c.cover_image_url as image_url,
				c.experience_count::int as count,
				null::text as city_id,
				null::text as city_slug,
				null::text as city_name,
				c.id::text as country_id,
				c.url as country_url,
				${countrySlug("c")} as country_slug,
				1 as sort_group
			from countries c
			where ${countrySearchText} ilike $1

			union all

			select
				'city' as type,
				c.id::text as id,
				null::text as slug,
				${displayName("c", "Город")} as title,
				'/' || coalesce(nullif(${countrySlug("country")}, ''), country.id::text) || '/' ||
					coalesce(nullif(${citySlug("c")}, ''), c.id::text) as url,
				c.image_cover as image_url,
				c.experience_count::int as count,
				c.id::text as city_id,
				${citySlug("c")} as city_slug,
				${displayName("c", "Город")} as city_name,
				c.country_id::text as country_id,
				country.url as country_url,
				${countrySlug("country")} as country_slug,
				2 as sort_group
			from cities c
			left join countries country on country.id = c.country_id
			where ${citySearchText} ilike $1

			union all

			select
				'category' as type,
				cat.id::text as id,
				null::text as slug,
				cat.sub_name as title,
				'/' || coalesce(nullif(${countrySlug("country")}, ''), country.id::text) || '/' ||
					coalesce(nullif(${citySlug("city")}, ''), city.id::text) || '/' ||
					coalesce(nullif(cat.sub_slug, ''), cat.id::text) as url,
				null::text as image_url,
				cat.count,
				city.id::text as city_id,
				${citySlug("city")} as city_slug,
				${displayName("city", "Город")} as city_name,
				city.country_id::text as country_id,
				country.url as country_url,
				${countrySlug("country")} as country_slug,
				3 as sort_group
			from ranked_categories cat
			inner join cities city on city.id = cat.city_id
			left join countries country on country.id = city.country_id

			union all

			select
				'experience' as type,
				e.id::text as id,
				e.slug,
				e.title,
				case
					when ${citySlug("city")} is not null and ${countrySlug("country")} is not null then
				'/' || ${countrySlug("country")} || '/' || ${citySlug("city")} || '/excursions/' || e.slug
					else '/excursions/' || e.slug
				end as url,
				null::text as image_url,
				coalesce(e.review_count, 0)::int as count,
				e.city_id::text as city_id,
				${citySlug("city")} as city_slug,
				${displayName("city", "Город")} as city_name,
				e.country_id::text as country_id,
				country.url as country_url,
				${countrySlug("country")} as country_slug,
				4 as sort_group
			from (
				select e.* from experiences e
				where $3::boolean and ${experienceSearchText} ilike $1
				order by coalesce(e.review_count, 0) desc, e.title asc
				limit $2
			) e
			left join cities city on city.id = e.city_id
			left join countries country on country.id = e.country_id
		) results
		order by sort_group asc, count desc nulls last, title asc
		limit $2
		`,
		[pattern, limit, scope === "all"],
	);
}

export interface SearchExperienceSuggestionRow {
	id: string;
	slug: string | null;
	title: string;
	image_url: string | null;
	review_count: number | null;
	city_slug: string | null;
	country_slug: string | null;
}

export interface SearchCategorySuggestionRow {
	id: string;
	title: string;
	url: string;
	count: number;
	city_id: string;
	city_slug: string | null;
	city_name: string | null;
	country_url: string | null;
	country_slug: string | null;
}

export async function getCitySearchCategories(
	cityId: string,
	limit = 6,
): Promise<QueryResult<SearchCategorySuggestionRow>> {
	return query<SearchCategorySuggestionRow>(
		`
		with category_counts as (
			select
				etn.catalog_id,
				count(*)::int as experience_count
			from experience_tags_new etn
			inner join experiences e on e.id = etn.experience_id
			where e.city_id = $1::int
			group by etn.catalog_id
		)
		select
			cat.id::text as id,
			cat.sub_name as title,
			'/' || coalesce(nullif(${countrySlug("country")}, ''), country.id::text) || '/' ||
				coalesce(nullif(${citySlug("city")}, ''), city.id::text) || '/' ||
				coalesce(nullif(cat.sub_slug, ''), cat.id::text) as url,
			coalesce(category_counts.experience_count, 0)::int as count,
			city.id::text as city_id,
			${citySlug("city")} as city_slug,
			${displayName("city", "Город")} as city_name,
			country.url as country_url,
			${countrySlug("country")} as country_slug
		from category_counts
		inner join tag_category_catalog cat on cat.id = category_counts.catalog_id
		inner join cities city on city.id = $1::int
		left join countries country on country.id = city.country_id
		where coalesce(cat.is_hidden, false) = false
		order by
			cat.main_sort_order asc nulls last,
			cat.sub_sort_order asc nulls last,
			category_counts.experience_count desc nulls last,
			cat.sub_name asc
		limit $2
		`,
		[Number(cityId), limit],
	);
}

export async function getCitySearchExperiences(
	cityId: string,
	limit = 6,
): Promise<QueryResult<SearchExperienceSuggestionRow>> {
	return query<SearchExperienceSuggestionRow>(
		`
		select
			e.id::text as id,
			e.slug,
			e.title,
			null::text as image_url,
			e.review_count,
			${citySlug("city")} as city_slug,
			${countrySlug("country")} as country_slug
		from (
			select e.* from experiences e
			where e.city_id = $1::int
			order by e.rating desc nulls last, e.review_count desc nulls last,
				e.visitors_count desc nulls last, e.id desc
			limit $2
		) e
		left join cities city on city.id = e.city_id
		left join countries country on country.id = e.country_id
		order by
			e.rating desc nulls last,
			e.review_count desc nulls last,
			e.visitors_count desc nulls last,
			e.id desc
		`,
		[Number(cityId), limit],
	);
}

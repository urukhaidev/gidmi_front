import { query } from "./db.js";
import { displayName, slugFromUrl } from "./sql-fragments.js";
import type { QueryResult, SearchResultRow } from "./travel-types.js";

export async function searchTravel(
	queryText: string | null | undefined,
	limit = 18,
): Promise<QueryResult<SearchResultRow>> {
	const normalized = queryText?.trim();

	if (!normalized || normalized.length < 2) {
		return { rows: [], error: null };
	}

	const pattern = `%${normalized}%`;
	const countrySearchText = "(coalesce(c.name_ru, '') || ' ' || coalesce(c.name_en, ''))";
	const citySearchText = "(coalesce(c.name_ru, '') || ' ' || coalesce(c.name_en, ''))";
	const tagSearchText = "(coalesce(ct.name, tt.name, '') || ' ' || coalesce(ct.slug, tt.slug, '') || ' ' || coalesce(ct.url, ''))";
	const experienceSearchText = "(coalesce(e.title, '') || ' ' || coalesce(e.tagline, '') || ' ' || coalesce(e.annotation, ''))";

	return query<SearchResultRow>(
		`
		select * from (
			select
				'country' as type,
				c.id::text as id,
				${displayName("c", "Страна")} as title,
				'/' || coalesce(nullif(${slugFromUrl("c")}, ''), c.id::text) as url,
				c.cover_image_url as image_url,
				c.experience_count::int as count,
				null::text as city_id,
				null::text as city_slug,
				null::text as city_name,
				c.id::text as country_id,
				c.url as country_url,
				${slugFromUrl("c")} as country_slug,
				1 as sort_group
			from countries c
			where ${countrySearchText} ilike $1

			union all

			select
				'city' as type,
				c.id::text as id,
				${displayName("c", "Город")} as title,
				'/' || coalesce(nullif(${slugFromUrl("country")}, ''), country.id::text) || '/' ||
					coalesce(nullif(c.slug, ''), nullif(${slugFromUrl("c")}, ''), c.id::text) as url,
				c.image_cover as image_url,
				c.experience_count::int as count,
				c.id::text as city_id,
				c.slug as city_slug,
				${displayName("c", "Город")} as city_name,
				c.country_id::text as country_id,
				country.url as country_url,
				${slugFromUrl("country")} as country_slug,
				2 as sort_group
			from cities c
			left join countries country on country.id = c.country_id
			where ${citySearchText} ilike $1

			union all

			select
				'category' as type,
				ct.citytag_id::text as id,
				coalesce(ct.name, tt.name) as title,
				'/' || coalesce(nullif(${slugFromUrl("country")}, ''), country.id::text) || '/' ||
					coalesce(nullif(city.slug, ''), nullif(${slugFromUrl("city")}, ''), city.id::text) || '/' ||
					coalesce(nullif(ct.slug, ''), nullif(tt.slug, ''), nullif(${slugFromUrl("ct")}, ''), ct.citytag_id::text) as url,
				ct.image_medium as image_url,
				coalesce(ct.experience_count, 0)::int as count,
				ct.city_id::text as city_id,
				city.slug as city_slug,
				${displayName("city", "Город")} as city_name,
				city.country_id::text as country_id,
				country.url as country_url,
				${slugFromUrl("country")} as country_slug,
				3 as sort_group
			from tripster_city_tags ct
			left join tripster_tags tt on tt.id = ct.tag_id
			left join cities city on city.id = ct.city_id
			left join countries country on country.id = city.country_id
			where ${tagSearchText} ilike $1
				and coalesce(ct.is_hidden, false) = false
				and coalesce(ct.experience_count, 0) > 0

			union all

			select
				'experience' as type,
				e.id::text as id,
				e.title,
				case
					when city.slug is not null and ${slugFromUrl("country")} is not null then
						'/' || ${slugFromUrl("country")} || '/' || city.slug || '/excursions/' || e.id::text
					else '/excursions/' || e.id::text
				end as url,
				e.cover_image_url as image_url,
				coalesce(e.review_count, 0)::int as count,
				e.city_id::text as city_id,
				city.slug as city_slug,
				${displayName("city", "Город")} as city_name,
				e.country_id::text as country_id,
				country.url as country_url,
				${slugFromUrl("country")} as country_slug,
				4 as sort_group
			from experiences e
			left join cities city on city.id = e.city_id
			left join countries country on country.id = e.country_id
			where ${experienceSearchText} ilike $1
		) results
		order by sort_group asc, count desc nulls last, title asc
		limit $2
		`,
		[pattern, limit],
	);
}

export interface SearchExperienceSuggestionRow {
	id: string;
	title: string;
	image_url: null;
	review_count: number | null;
	city_slug: string | null;
	country_slug: string | null;
}

export async function getCitySearchExperiences(
	cityId: string,
	limit = 6,
): Promise<QueryResult<SearchExperienceSuggestionRow>> {
	return query<SearchExperienceSuggestionRow>(
		`
		select
			e.id::text as id,
			e.title,
			null::text as image_url,
			e.review_count,
			city.slug as city_slug,
			${slugFromUrl("country")} as country_slug
		from experiences e
		left join cities city on city.id = e.city_id
		left join countries country on country.id = e.country_id
		where e.city_id = $1::int
		order by
			e.rating desc nulls last,
			e.review_count desc nulls last,
			e.visitors_count desc nulls last,
			e.id desc
		limit $2
		`,
		[Number(cityId), limit],
	);
}

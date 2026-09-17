import { query } from "./db.js";
import { cityColumns, citySlug, countrySlug, displayNameShort, slugFromUrl } from "./sql-fragments.js";
import type { CityDetailRow, CityRow, CityTopRow, QueryResult } from "./travel-types.js";

export async function getTopCities(limit = 30): Promise<QueryResult<CityTopRow>> {
	return query<CityTopRow>(
		`
		select
			e.city_id::text as id,
			coalesce(nullif(c.name_ru, ''), nullif(c.name_en, ''), 'Город ' || e.city_id::text) as name,
			${citySlug("c")} as slug,
			c.url,
			c.image_cover as image_url,
			c.country_id::text as country_id,
			${displayNameShort("country")} as country_name,
			country.url as country_url,
			${countrySlug("country")} as country_slug,
			count(e.id)::int as experience_count
		from experiences e
		left join cities c on c.id = e.city_id
		left join countries country on country.id = c.country_id
		where e.city_id is not null
		group by e.city_id, c.name_ru, c.name_en, c.page_slug, c.slug, c.url, c.image_cover, c.country_id, country.name_ru, country.name_en, country.url, country.page_slug
		order by count(e.id) desc, name asc
		limit $1
		`,
		[limit],
	);
}

export async function getCities(limit = 120): Promise<QueryResult<CityRow>> {
	return query<CityRow>(
		`
		select ${cityColumns()}
		from cities c
		left join countries country on country.id = c.country_id
		order by c.experience_count desc nulls last, name asc
		limit $1
		`,
		[limit],
	);
}

export async function getCity(id: string | undefined): Promise<QueryResult<CityDetailRow>> {
	const numericId = Number(id);
	const isNumericId = Number.isInteger(numericId);

	return query<CityDetailRow>(
		`
		select
			${cityColumns()},
			${displayNameShort("country")} as country_name
		from cities c
		left join countries country on country.id = c.country_id
		where ${
			isNumericId
				? "c.id = $1"
				: `lower(c.page_slug) = lower($1)
			or lower(c.slug) = lower($1)
			or lower(${slugFromUrl("c")}) = lower($1)`
		}
		limit 1
		`,
		[isNumericId ? numericId : String(id)],
	);
}

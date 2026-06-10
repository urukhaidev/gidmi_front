import { query } from "./db.js";
import { countryColumns, slugFromUrl } from "./sql-fragments.js";
import type { CountryRow, CountryTopRow, QueryResult } from "./travel-types.js";

export async function getTopCountries(limit = 30): Promise<QueryResult<CountryTopRow>> {
	return query<CountryTopRow>(
		`
		select
			e.country_id::text as id,
			coalesce(nullif(c.name_ru, ''), nullif(c.name_en, ''), 'Страна ' || e.country_id::text) as name,
			c.url,
			${slugFromUrl("c")} as slug,
			c.cover_image_url as image_url,
			count(e.id)::int as experience_count
		from experiences e
		left join countries c on c.id = e.country_id
		where e.country_id is not null
		group by e.country_id, c.name_ru, c.name_en, c.url, c.cover_image_url
		order by count(e.id) desc, name asc
		limit $1
		`,
		[limit],
	);
}

export async function getCountries(limit = 120): Promise<QueryResult<CountryRow>> {
	return query<CountryRow>(
		`
		select ${countryColumns()}
		from countries c
		order by c.experience_count desc nulls last, name asc
		limit $1
		`,
		[limit],
	);
}

export async function getCountry(id: string | undefined): Promise<QueryResult<CountryRow>> {
	return query<CountryRow>(
		`
		select ${countryColumns()}
		from countries c
		where c.id::text = $1
			or lower(${slugFromUrl("c")}) = lower($1)
		limit 1
		`,
		[String(id)],
	);
}

export async function getCountryCities(
	countryId: string,
	limit = 120,
): Promise<QueryResult<import("./travel-types.js").CityRow>> {
	const { cityColumns } = await import("./sql-fragments.js");
	return query(
		`
		select ${cityColumns()}
		from cities c
		left join countries country on country.id = c.country_id
		where c.country_id::text = $1
		order by c.experience_count desc nulls last, name asc
		limit $2
		`,
		[String(countryId), limit],
	);
}

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
				1 as sort_group
			from countries c
			where c.name_ru ilike $1 or c.name_en ilike $1

			union all

			select
				'city' as type,
				c.id::text as id,
				${displayName("c", "Город")} as title,
				'/' || coalesce(nullif(${slugFromUrl("country")}, ''), country.id::text) || '/' ||
					coalesce(nullif(c.slug, ''), nullif(${slugFromUrl("c")}, ''), c.id::text) as url,
				c.image_cover as image_url,
				c.experience_count::int as count,
				2 as sort_group
			from cities c
			left join countries country on country.id = c.country_id
			where c.name_ru ilike $1 or c.name_en ilike $1

			union all

			select
				'experience' as type,
				e.id::text as id,
				e.title,
				'/excursions/' || e.id::text as url,
				e.cover_image_url as image_url,
				coalesce(e.review_count, 0)::int as count,
				3 as sort_group
			from experiences e
			where e.title ilike $1 or e.tagline ilike $1 or e.annotation ilike $1
		) results
		order by sort_group asc, count desc nulls last, title asc
		limit $2
		`,
		[pattern, limit],
	);
}

import { query } from "./db.js";
import { displayNameShort } from "./sql-fragments.js";
import type { GuideFilters, GuideRow, QueryResult } from "./travel-types.js";

export async function getGuides(
	filters: GuideFilters = {},
): Promise<QueryResult<GuideRow>> {
	const where: string[] = [];
	const params: unknown[] = [];

	if (filters.countryId) {
		params.push(Number(filters.countryId));
		where.push(`city.country_id = $${params.length}`);
	}

	if (filters.cityId) {
		params.push(Number(filters.cityId));
		where.push(`g.city_id = $${params.length}`);
	}

	const limit = filters.limit ?? 12;
	params.push(limit);

	const whereClause = where.length ? `where ${where.join(" and ")}` : "";

	return query<GuideRow>(
		`
		select
			g.id::text as id,
			g.first_name,
			null::text as last_name,
			g.url,
			g.avatar_medium as image_url,
			g.rating,
			g.review_count,
			g.exp_count_published,
			g.description,
			g.city_id::text as city_id,
			${displayNameShort("city")} as city_name
		from guides g
		left join cities city on city.id = g.city_id
		${whereClause}
		order by
			g.rating desc nulls last,
			g.review_count desc nulls last,
			g.exp_count_published desc nulls last,
			g.id desc
		limit $${params.length}
		`,
		params,
	);
}

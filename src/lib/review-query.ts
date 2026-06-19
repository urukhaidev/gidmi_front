import { query } from "./db.js";
import { slugFromUrl } from "./sql-fragments.js";
import type { QueryResult, ReviewFilters, ReviewRow } from "./travel-types.js";

const reviewColumns = `
	r.id::text as id,
	r.experience_id::text as experience_id,
	r.author_name,
	coalesce(r.avatar_medium_url, r.avatar_small_url) as avatar_url,
	coalesce(r.created_on::text, r.created_at::date::text, r.created_on_dt::date::text) as created_on,
	r.rating,
	r.text,
	r.experience_title,
	e.title,
	city.slug as city_slug,
	${slugFromUrl("country")} as country_slug,
	country.url as country_url`;

const reviewJoins = `
	left join experiences e on e.id = r.experience_id
	left join cities city on city.id = e.city_id
	left join countries country on country.id = e.country_id`;

export async function getReviews(
	filters: ReviewFilters = {},
): Promise<QueryResult<ReviewRow>> {
	const where = ["nullif(trim(coalesce(r.text, '')), '') is not null"];
	const params: unknown[] = [];
	const extraJoins: string[] = [];

	if (filters.experienceId) {
		params.push(Number(filters.experienceId));
		where.push(`r.experience_id = $${params.length}`);
	}

	if (filters.cityId) {
		params.push(Number(filters.cityId));
		where.push(`e.city_id = $${params.length}`);
	}

	if (filters.cityTagId) {
		extraJoins.push("inner join experience_tags et on et.experience_id = r.experience_id");
		params.push(Number(filters.cityTagId));
		where.push(`et.citytag_id = $${params.length}`);
	}

	const limit = filters.limit ?? 6;
	params.push(limit);

	return query<ReviewRow>(
		`
		select ${reviewColumns}
		from experience_reviews r
		${extraJoins.join("\n")}
		${reviewJoins}
		where ${where.join(" and ")}
		order by
			coalesce(r.created_at, r.created_on_dt::timestamptz, r.created_on::timestamptz) desc nulls last,
			r.id desc
		limit $${params.length}
		`,
		params,
	);
}

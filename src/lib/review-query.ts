import { query } from "./db.js";
import { citySlug, countrySlug } from "./sql-fragments.js";
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
	${citySlug("city")} as city_slug,
	${countrySlug("country")} as country_slug,
	country.url as country_url`;

const reviewJoins = `
	left join experiences e on e.id = r.experience_id
	left join cities city on city.id = e.city_id
	left join countries country on country.id = e.country_id`;

// Keep all timestamp values in an explicit timezone. Besides making the
// ordering deterministic, this expression can be backed by an index.
const reviewOrderTimestamp = `coalesce(
	r.created_at at time zone 'UTC',
	r.created_on_dt,
	r.created_on::timestamp
)`;

export async function getReviews(
	filters: ReviewFilters = {},
): Promise<QueryResult<ReviewRow>> {
	// City pages need only a few recent reviews. With city_id denormalized on
	// reviews, PostgreSQL can fetch those rows from one ordered index instead
	// of collecting and sorting every review for every excursion in the city.
	if (filters.cityId && !filters.categoryId && !filters.experienceId) {
		const limit = filters.limit ?? 6;

		return query<ReviewRow>(
			`
			with recent_reviews as (
				select r.*
				from experience_reviews r
				where r.city_id = $1
					and nullif(trim(coalesce(r.text, '')), '') is not null
				order by
					${reviewOrderTimestamp} desc nulls last,
					r.id desc
				limit $2
			)
			select ${reviewColumns}
			from recent_reviews r
			${reviewJoins}
			order by
				${reviewOrderTimestamp} desc nulls last,
				r.id desc
			`,
			[Number(filters.cityId), limit],
		);
	}

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

	if (filters.categoryId) {
		params.push(Number(filters.categoryId));
		where.push(
			`exists (select 1 from experience_tags_new etn where etn.experience_id = r.experience_id and etn.catalog_id = $${params.length})`,
		);
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
			${reviewOrderTimestamp} desc nulls last,
			r.id desc
		limit $${params.length}
		`,
		params,
	);
}

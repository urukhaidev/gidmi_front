import { query } from "./db.js";
import { tagColumns } from "./sql-fragments.js";
import type { QueryResult, TagRow } from "./travel-types.js";

export async function getTags(limit = 120): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		select ${tagColumns()}
		from tags t
		left join cities city on city.id = t.city_id
		left join countries country on country.id = city.country_id
		where coalesce(t.is_hidden, false) = false
		order by t.experience_count desc nulls last, t.name asc
		limit $1
		`,
		[limit],
	);
}

export async function getTag(id: string | undefined): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		select ${tagColumns()}
		from tags t
		left join cities city on city.id = t.city_id
		left join countries country on country.id = city.country_id
		where t.citytag_id::text = $1
		limit 1
		`,
		[String(id)],
	);
}

export async function getCityTags(
	cityId: string,
	limit = 80,
): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		select ${tagColumns()}
		from tags t
		left join cities city on city.id = t.city_id
		left join countries country on country.id = city.country_id
		where t.city_id::text = $1
			and coalesce(t.is_hidden, false) = false
			and coalesce(t.experience_count, 0) > 0
		order by
			case when lower(coalesce(t.category, '')) = 'top' then 0 else 1 end,
			t.experience_count desc nulls last,
			t.name asc
		limit $2
		`,
		[String(cityId), limit],
	);
}

export async function getCityTag(
	cityId: string,
	tagParam: string | undefined,
): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		select ${tagColumns()}
		from tags t
		left join cities city on city.id = t.city_id
		left join countries country on country.id = city.country_id
		where t.city_id::text = $1
			and coalesce(t.is_hidden, false) = false
			and (
				t.citytag_id::text = $2
				or lower(t.slug) = lower($2)
				or lower(t.tag_slug) = lower($2)
				or lower(regexp_replace(trim(trailing '/' from t.url), '^.*/', '')) = lower($2)
			)
		limit 1
		`,
		[String(cityId), String(tagParam)],
	);
}

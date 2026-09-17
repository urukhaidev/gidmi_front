import { query } from "./db.js";
import { tagColumns } from "./sql-fragments.js";
import type { QueryResult, TagRow } from "./travel-types.js";

export async function getTags(limit = 120): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		with category_counts as (
			select etn.catalog_id, count(distinct etn.experience_id)::int as experience_count
			from experience_tags_new etn
			group by etn.catalog_id
		)
		select ${tagColumns("cat", "cc.experience_count")}
		from category_counts cc
		inner join tag_category_catalog cat on cat.id = cc.catalog_id
		left join cities city on false
		left join countries country on false
		order by
			cat.main_sort_order asc nulls last,
			cat.sub_sort_order asc nulls last,
			cc.experience_count desc nulls last,
			cat.sub_name asc
		limit $1
		`,
		[limit],
	);
}

export async function getTag(id: string | undefined): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		select ${tagColumns("cat")}
		from tag_category_catalog cat
		left join cities city on false
		left join countries country on false
		where cat.id::text = $1
		order by cat.main_sort_order asc nulls last, cat.sub_sort_order asc nulls last
		limit 1
		`,
		[String(id)],
	);
}

export async function getCityTags(
	cityId: string,
	limit?: number,
): Promise<QueryResult<TagRow>> {
	const limitClause = limit ? "limit $2" : "";
	const params = limit ? [Number(cityId), limit] : [Number(cityId)];

	return query<TagRow>(
		`
		with city_categories as (
			select
				etn.catalog_id,
				count(distinct etn.experience_id)::int as experience_count
			from experience_tags_new etn
			inner join experiences e on e.id = etn.experience_id
			inner join tag_category_catalog cat on cat.id = etn.catalog_id
			where e.city_id = $1::int
			group by etn.catalog_id
		)
		select ${tagColumns("cat", "cc.experience_count")}
		from city_categories cc
		inner join tag_category_catalog cat on cat.id = cc.catalog_id
		inner join cities city on city.id = $1::int
		left join countries country on country.id = city.country_id
		order by
			cat.main_sort_order asc nulls last,
			cat.sub_sort_order asc nulls last,
			cc.experience_count desc nulls last,
			cat.sub_name asc
		${limitClause}
		`,
		params,
	);
}

export async function getCityTag(
	cityId: string,
	tagParam: string | undefined,
): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		with city_categories as (
			select etn.catalog_id, count(distinct etn.experience_id)::int as experience_count
			from experience_tags_new etn
			inner join experiences e on e.id = etn.experience_id
			inner join tag_category_catalog cat on cat.id = etn.catalog_id
			where e.city_id = $1::int
			group by etn.catalog_id
		)
		select ${tagColumns("cat", "cc.experience_count")}
		from city_categories cc
		inner join tag_category_catalog cat on cat.id = cc.catalog_id
		inner join cities city on city.id = $1::int
		left join countries country on country.id = city.country_id
		where (
			cc.catalog_id::text = $2
			or lower(cat.sub_slug) = lower($2)
		)
		order by cat.main_sort_order asc nulls last, cat.sub_sort_order asc nulls last
		limit 1
		`,
		[Number(cityId), String(tagParam)],
	);
}

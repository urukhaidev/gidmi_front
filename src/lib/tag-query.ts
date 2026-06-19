import { query } from "./db.js";
import { tagColumns } from "./sql-fragments.js";
import type { QueryResult, TagRow } from "./travel-types.js";

export async function getTags(limit = 120): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		with selected_city_tags as (
			select ct.*
			from tripster_city_tags ct
			left join tripster_tags tt on tt.id = ct.tag_id
			where coalesce(ct.is_hidden, false) = false
			order by ct.experience_count desc nulls last, coalesce(ct.name, tt.name) asc
			limit $1
		)
		select ${tagColumns()}
		from selected_city_tags ct
		left join tripster_tags tt on tt.id = ct.tag_id
		left join tag_category_links tcl on tcl.tag_id = ct.tag_id
		left join tag_category_catalog cat on cat.id = tcl.catalog_id
		left join cities city on city.id = ct.city_id
		left join countries country on country.id = city.country_id
		order by
			cat.main_sort_order asc nulls last,
			cat.sub_sort_order asc nulls last,
			ct.experience_count desc nulls last,
			coalesce(ct.name, tt.name) asc
		limit $1
		`,
		[limit],
	);
}

export async function getTag(id: string | undefined): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		select ${tagColumns()}
		from tripster_city_tags ct
		left join tripster_tags tt on tt.id = ct.tag_id
		left join tag_category_links tcl on tcl.tag_id = ct.tag_id
		left join tag_category_catalog cat on cat.id = tcl.catalog_id
		left join cities city on city.id = ct.city_id
		left join countries country on country.id = city.country_id
		where ct.citytag_id::text = $1
		order by cat.main_sort_order asc nulls last, cat.sub_sort_order asc nulls last
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
		with selected_city_tags as (
			select ct.*
			from tripster_city_tags ct
			left join tripster_tags tt on tt.id = ct.tag_id
			where ct.city_id = $1::int
				and coalesce(ct.is_hidden, false) = false
				and coalesce(ct.experience_count, 0) > 0
			order by
				case when lower(coalesce(ct.category, tt.category, '')) = 'top' then 0 else 1 end,
				ct.experience_count desc nulls last,
				coalesce(ct.name, tt.name) asc
			limit $2
		)
		select ${tagColumns()}
		from selected_city_tags ct
		left join tripster_tags tt on tt.id = ct.tag_id
		left join tag_category_links tcl on tcl.tag_id = ct.tag_id
		left join tag_category_catalog cat on cat.id = tcl.catalog_id
		left join cities city on city.id = ct.city_id
		left join countries country on country.id = city.country_id
		order by
			case when lower(coalesce(ct.category, tt.category, '')) = 'top' then 0 else 1 end,
			cat.main_sort_order asc nulls last,
			cat.sub_sort_order asc nulls last,
			ct.experience_count desc nulls last,
			coalesce(ct.name, tt.name) asc
		limit $2
		`,
		[Number(cityId), limit],
	);
}

export async function getCityTag(
	cityId: string,
	tagParam: string | undefined,
): Promise<QueryResult<TagRow>> {
	return query<TagRow>(
		`
		select ${tagColumns()}
		from tripster_city_tags ct
		left join tripster_tags tt on tt.id = ct.tag_id
		left join tag_category_links tcl on tcl.tag_id = ct.tag_id
		left join tag_category_catalog cat on cat.id = tcl.catalog_id
		left join cities city on city.id = ct.city_id
		left join countries country on country.id = city.country_id
		where ct.city_id = $1::int
			and coalesce(ct.is_hidden, false) = false
			and (
				ct.citytag_id::text = $2
				or lower(ct.slug) = lower($2)
				or lower(tt.slug) = lower($2)
				or lower(regexp_replace(trim(trailing '/' from ct.url), '^.*/', '')) = lower($2)
			)
		order by cat.main_sort_order asc nulls last, cat.sub_sort_order asc nulls last
		limit 1
		`,
		[Number(cityId), String(tagParam)],
	);
}

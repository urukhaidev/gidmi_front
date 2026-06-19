import { query } from "./db.js";
import {
	experienceCardColumns,
	experienceCardJoins,
	experienceColumns,
	experienceJoins,
	experienceOrderBy,
} from "./sql-fragments.js";
import type {
	ExperienceFilters,
	ExperiencePhotoRow,
	ExperienceRow,
	ExperienceStatsRow,
	QueryResult,
	TagRow,
} from "./travel-types.js";

export async function getPopularExperiences(
	limit = 12,
): Promise<QueryResult<ExperienceRow>> {
	return query<ExperienceRow>(
		`
		select ${experienceCardColumns}
		from experiences e
		${experienceCardJoins}
		order by ${experienceOrderBy("popular")}
		limit $1
		`,
		[limit],
	);
}

export async function getExperiences(
	filters: ExperienceFilters = {},
): Promise<QueryResult<ExperienceRow>> {
	const { where, params, extraJoins } = buildExperienceFilterClauses(filters);

	const limit = filters.limit ?? 48;
	const offset = filters.offset ?? 0;
	params.push(limit);
	const limitParam = params.length;
	params.push(offset);
	const offsetParam = params.length;

	const whereClause = where.length ? `where ${where.join(" and ")}` : "";

	return query<ExperienceRow>(
		`
		select ${experienceCardColumns}
		from experiences e
		${extraJoins.join("\n")}
		${experienceCardJoins}
		${whereClause}
		order by ${experienceOrderBy(filters.sort)}
		limit $${limitParam}
		offset $${offsetParam}
		`,
		params,
	);
}

export async function getExperienceStats(
	filters: Pick<ExperienceFilters, "countryId" | "cityId" | "cityTagId"> = {},
): Promise<QueryResult<ExperienceStatsRow>> {
	const { where, params, extraJoins } = buildExperienceFilterClauses(filters);
	const whereClause = where.length ? `where ${where.join(" and ")}` : "";

	return query<ExperienceStatsRow>(
		`
		with filtered as (
			select
				e.id,
				e.price_value,
				e.price_currency
			from experiences e
			${extraJoins.join("\n")}
			${whereClause}
		),
		min_price as (
			select
				price_value,
				price_currency
			from filtered
			where price_value is not null
			order by price_value asc nulls last, id desc
			limit 1
		)
		select
			count(filtered.id)::int as count,
			min_price.price_value as min_price_value,
			min_price.price_currency as min_price_currency
		from filtered
		left join min_price on true
		group by min_price.price_value, min_price.price_currency
		`,
		params,
	);
}

function buildExperienceFilterClauses(filters: ExperienceFilters) {
	const where: string[] = [];
	const params: unknown[] = [];
	const extraJoins: string[] = [];

	if (filters.countryId) {
		params.push(Number(filters.countryId));
		where.push(`e.country_id = $${params.length}`);
	}

	if (filters.cityId) {
		params.push(Number(filters.cityId));
		where.push(`e.city_id = $${params.length}`);
	}

	const personCount = Number(filters.persons);
	if (Number.isInteger(personCount) && personCount > 1) {
		params.push(personCount);
		where.push(`(e.max_persons is null or e.max_persons >= $${params.length})`);
	}

	if (filters.format && filters.format !== "any") {
		params.push(String(filters.format));
		where.push(`e.format = $${params.length}`);
	}

	if (filters.movement && filters.movement !== "any") {
		params.push(String(filters.movement));
		where.push(`e.movement_type = $${params.length}`);
	}

	if (filters.price === "low") {
		where.push("e.price_value is not null and e.price_value <= 2000");
	} else if (filters.price === "mid") {
		where.push(
			"e.price_value is not null and e.price_value > 2000 and e.price_value <= 5000",
		);
	} else if (filters.price === "high") {
		where.push("e.price_value is not null and e.price_value > 5000");
	}

	if (filters.cityTagId) {
		extraJoins.push(
			"inner join experience_tags et on et.experience_id = e.id",
		);
		params.push(Number(filters.cityTagId));
		where.push(`et.citytag_id = $${params.length}`);
	}

	return { where, params, extraJoins };
}

export async function getExperience(
	id: string | undefined,
): Promise<QueryResult<ExperienceRow>> {
	return query<ExperienceRow>(
		`
		select ${experienceColumns}
		from experiences e
		${experienceJoins}
		where e.id = $1
		limit 1
		`,
		[Number(id)],
	);
}

export async function getExperiencePhotos(
	experienceId: string | undefined,
	limit = 12,
): Promise<QueryResult<ExperiencePhotoRow>> {
	return query<ExperiencePhotoRow>(
		`
		select
			p.id::text as id,
			p.position,
			coalesce(p.medium_url, p.thumbnail_xl_url, p.thumbnail_l_url,
			         p.thumbnail_m_url, p.thumbnail_url) as image_url
		from experience_photos p
		where p.experience_id = $1
		order by p.position asc
		limit $2
		`,
		[Number(experienceId), limit],
	);
}

export async function getExperienceTags(
	experienceId: string | undefined,
	limit = 24,
): Promise<QueryResult<TagRow>> {
	const { tagColumns } = await import("./sql-fragments.js");
	return query<TagRow>(
		`
		with selected_city_tags as (
			select ct.*
			from (
				select distinct citytag_id
				from experience_tags
				where experience_id = $1
			) et
			inner join tripster_city_tags ct on ct.citytag_id = et.citytag_id
			left join tripster_tags tt on tt.id = ct.tag_id
			order by ct.experience_count desc nulls last, coalesce(ct.name, tt.name) asc
			limit $2
		)
		select
			${tagColumns()}
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
		limit $2
		`,
		[Number(experienceId), limit],
	);
}

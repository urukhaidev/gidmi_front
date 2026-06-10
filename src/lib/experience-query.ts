import { query } from "./db.js";
import {
	experienceColumns,
	experienceJoins,
	experienceOrderBy,
} from "./sql-fragments.js";
import type {
	ExperienceFilters,
	ExperiencePhotoRow,
	ExperienceRow,
	QueryResult,
	TagRow,
} from "./travel-types.js";

export async function getPopularExperiences(
	limit = 12,
): Promise<QueryResult<ExperienceRow>> {
	return query<ExperienceRow>(
		`
		select ${experienceColumns}
		from experiences e
		${experienceJoins}
		order by ${experienceOrderBy("popular")}
		limit $1
		`,
		[limit],
	);
}

export async function getExperiences(
	filters: ExperienceFilters = {},
): Promise<QueryResult<ExperienceRow>> {
	const where: string[] = [];
	const params: unknown[] = [];
	const extraJoins: string[] = [];

	if (filters.countryId) {
		params.push(String(filters.countryId));
		where.push(`e.country_id::text = $${params.length}`);
	}

	if (filters.cityId) {
		params.push(String(filters.cityId));
		where.push(`e.city_id::text = $${params.length}`);
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

	const limit = filters.limit ?? 48;
	params.push(limit);

	const whereClause = where.length ? `where ${where.join(" and ")}` : "";

	return query<ExperienceRow>(
		`
		select ${experienceColumns}
		from experiences e
		${extraJoins.join("\n")}
		${experienceJoins}
		${whereClause}
		order by ${experienceOrderBy(filters.sort)}
		limit $${params.length}
		`,
		params,
	);
}

export async function getExperience(
	id: string | undefined,
): Promise<QueryResult<ExperienceRow>> {
	return query<ExperienceRow>(
		`
		select ${experienceColumns}
		from experiences e
		${experienceJoins}
		where e.id::text = $1
		limit 1
		`,
		[String(id)],
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
		where p.experience_id::text = $1
		order by p.position asc
		limit $2
		`,
		[String(experienceId), limit],
	);
}

export async function getExperienceTags(
	experienceId: string | undefined,
	limit = 24,
): Promise<QueryResult<TagRow>> {
	const { tagColumns } = await import("./sql-fragments.js");
	return query<TagRow>(
		`
		select distinct
			${tagColumns()}
		from experience_tags et
		inner join tags t on t.citytag_id = et.citytag_id
		left join cities city on city.id = t.city_id
		left join countries country on country.id = city.country_id
		where et.experience_id::text = $1
		order by t.experience_count desc nulls last, t.name asc
		limit $2
		`,
		[String(experienceId), limit],
	);
}

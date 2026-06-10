import type { APIRoute } from "astro";
import {
	cityCategoryHref,
	cityHref,
	getCity,
	getExperience,
	experienceHref,
	getCityTags,
	getExperiences,
	searchTravel,
} from "../../lib/travel-db.js";

export const GET: APIRoute = async ({ url }) => {
	const q = url.searchParams.get("q") ?? "";

	if (q.trim().length < 2) {
		return Response.json({ results: [] });
	}

	const { rows, error } = await searchTravel(q, 12);

	if (error) {
		return Response.json({ results: [], error }, { status: 502 });
	}

	const city = rows.find((item) => item.type === "city");
	const experience = city ? null : rows.find((item) => item.type === "experience");
	const experienceCityResult = experience
		? await getExperience(experience.id)
		: null;
	const experienceCityId = experienceCityResult?.rows[0]?.city_id ?? null;
	const cityId = city?.id ?? experienceCityId;
	const cityDetails = cityId
		? await Promise.all([
			getCity(cityId),
			getCityTags(cityId, 6),
			getExperiences({ cityId, limit: 6 }),
		])
		: null;
	const cityRow = cityDetails?.[0].rows[0] ?? null;
	const cityTitle = cityRow?.name ?? city?.title;
	const cityUrl = cityRow ? cityHref(cityRow) : city?.url;
	const cityInPhrase = cityRow?.in_obj_phrase || (cityTitle ? `в ${cityTitle}` : "");
	const cityRoutePhrase = cityInPhrase
		.replace(/^в\s+/i, "")
		.replace(/^во\s+/i, "");

	const citySearch = cityDetails
		? {
			cityId,
			cityTitle,
			categoryTitle: cityInPhrase ? `Категории ${cityInPhrase}` : "Категории",
			excursionTitle: cityRoutePhrase ? `Экскурсии по ${cityRoutePhrase}` : "Экскурсии",
			allCategories: cityUrl
				? { id: `${cityId}-all-categories`, title: "Все категории", url: `${cityUrl}#categories`, count: cityRow?.experience_count ?? city?.count ?? 0 }
				: null,
			allExperiences: cityUrl
				? { id: `${cityId}-all-experiences`, title: "Все экскурсии", url: `${cityUrl}#excursions`, count: cityRow?.experience_count ?? city?.count ?? 0 }
				: null,
			categories: cityDetails[1].rows
				.filter((tag) => tag.name.toLowerCase() !== "все" && tag.slug !== "all" && tag.slug !== "vse")
				.map((tag) => ({
					id: tag.id,
					title: tag.name,
					url: cityCategoryHref(
						{
							id: tag.city_id,
							slug: tag.city_slug,
							country_slug: tag.country_slug,
							country_url: tag.country_url,
						},
						tag,
					),
					count: tag.experience_count,
				})),
			experiences: cityDetails[2].rows.map((experience) => ({
				id: experience.id,
				title: experience.title,
				url: experienceHref(experience),
				image_url: experience.image_url,
				count: experience.review_count ?? 0,
			})),
		}
		: null;

	return Response.json(
		{ results: rows, citySearch },
		{
			headers: {
				"Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
			},
		},
	);
};

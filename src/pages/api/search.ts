import type { APIRoute } from "astro";
import {
	cityHref,
	getCitySearchCategories,
	getCitySearchExperiences,
	getCity,
	experienceHref,
	searchTravel,
} from "../../lib/travel-db.js";

const responseCache = new Map<string, { expiresAt: number; body: string }>();
const resultCache = new Map<string, {
	expiresAt: number;
	result: ReturnType<typeof searchTravel>;
}>();
const getSearchResults = (q: string) => {
	const key = q.trim().toLocaleLowerCase("ru-RU");
	const cached = resultCache.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.result;
	if (resultCache.size >= 100) resultCache.delete(resultCache.keys().next().value!);
	const result = (async () => {
		const destinations = await searchTravel(q, 12, "destinations");
		const response = destinations.error || destinations.rows.length
			? destinations : await searchTravel(q, 12);
		if (response.error) resultCache.delete(key);
		return response;
	})();
	resultCache.set(key, { expiresAt: Date.now() + 30_000, result });
	return result;
};
const searchResponse = (body: string) => new Response(body, {
	headers: {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=60",
	},
});

export const GET: APIRoute = async ({ url, request }) => {
	const q = url.searchParams.get("q") ?? "";

	if (q.trim().length < 3) {
		return Response.json({ results: [] });
	}
	const includeDetails = url.searchParams.get("details") !== "0";
	const cacheKey = `${q.trim().toLocaleLowerCase("ru-RU")}:${includeDetails}`;
	const cached = responseCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) return searchResponse(cached.body);

	// A destination match already gets its own relevant categories and excursions
	// below; don't also aggregate matching categories across the entire catalogue.
	const { rows: rawRows, error } = await getSearchResults(q);
	if (request.signal.aborted) return new Response(null, { status: 204 });

	if (error) {
		return Response.json({ results: [], error }, { status: 502 });
	}

	const rows = rawRows.map((item) => item.type === "experience"
		? { ...item, url: experienceHref(item) }
		: item);
	const city = rows.find((item) => item.type === "city");
	const category = city ? null : rows.find((item) => item.type === "category");
	const experience = city || category ? null : rows.find((item) => item.type === "experience");
	const categoryCityId = category?.city_id ?? null;
	const experienceCityId = experience?.city_id ?? null;
	const cityId = city?.id ?? categoryCityId ?? experienceCityId;
	const isCategorySearch = !city && Boolean(category);
	const isExperienceSearch = !city && Boolean(experience);
	const cityDetails = includeDetails && cityId && !request.signal.aborted
		? await Promise.all([
			getCity(cityId),
			getCitySearchCategories(cityId, 6),
			getCitySearchExperiences(cityId, 6),
		])
		: null;
	if (request.signal.aborted) return new Response(null, { status: 204 });
	const cityRow = cityDetails?.[0].rows[0] ?? null;
	const cityExperienceCount = cityRow?.experience_count ?? city?.count ?? 0;
	const cityTitle = cityRow?.name ?? city?.title;
	const cityUrl = cityRow ? cityHref(cityRow) : city?.url;
	const cityInPhrase = cityRow?.in_obj_phrase || (cityTitle ? `в ${cityTitle}` : "");
	const cityRoutePhrase = cityInPhrase
		.replace(/^в\s+/i, "")
		.replace(/^во\s+/i, "");
	const matchedCityExperiences = isExperienceSearch
		? rows
			.filter((item) => item.type === "experience" && item.city_id === cityId)
			.slice(0, 6)
		: [];
	const sectionExperiences = matchedCityExperiences.length > 0
		? matchedCityExperiences.map((experience) => ({
			id: experience.id,
			title: experience.title,
			url: experience.url,
			image_url: null,
			count: experience.count,
		}))
		: (cityDetails?.[2].rows ?? []).map((experience) => ({
			id: experience.id,
			title: experience.title,
			url: experienceHref(experience),
			image_url: experience.image_url,
			count: experience.review_count ?? 0,
		}));

	const citySearch = cityDetails
		? {
			cityId,
			cityTitle,
			searchMode: isExperienceSearch ? "experience" : isCategorySearch ? "category" : "city",
			categoryTitle: cityInPhrase ? `Категории ${cityInPhrase}` : "Категории",
			excursionTitle: isExperienceSearch && cityInPhrase
				? `Экскурсии ${cityInPhrase}`
				: cityRoutePhrase
					? `Экскурсии по ${cityRoutePhrase}`
					: "Экскурсии",
			allCategories: cityUrl && !isCategorySearch
				? { id: `${cityId}-all-categories`, title: "Все категории", url: `${cityUrl}#categories`, count: cityExperienceCount }
				: null,
			allExperiences: cityUrl && !isExperienceSearch
				? { id: `${cityId}-all-experiences`, title: "Все экскурсии", url: `${cityUrl}#excursions`, count: cityExperienceCount }
				: null,
			categories: cityDetails[1].rows
				.filter((tag) => tag.title.toLowerCase() !== "все")
				.map((tag) => ({
					id: tag.id,
					title: tag.title,
					url: tag.url,
					count: tag.count,
				})),
			experiences: sectionExperiences,
		}
		: null;

	const body = JSON.stringify({ results: rows, citySearch });
	if (!cityDetails?.some((result) => result.error)) {
		if (responseCache.size >= 100) responseCache.delete(responseCache.keys().next().value!);
		responseCache.set(cacheKey, { expiresAt: Date.now() + 30_000, body });
	}
	return searchResponse(body);
};

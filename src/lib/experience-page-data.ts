import {
	getCitySearchCategories,
	getExperiencePhotos,
	getExperiences,
	getReviews,
	getTopCities,
	getTopCountries,
	type ExperienceRow,
} from "./travel-db.js";

export async function getExperiencePageData(experience: Pick<ExperienceRow, "id" | "city_id">) {
	const [photosResult, reviewsResult, relatedResult, cities, countries, categories] = await Promise.all([
		getExperiencePhotos(experience.id),
		getReviews({ experienceId: experience.id, limit: 8 }),
		getExperiences({ limit: 5, cityId: experience.city_id }),
		getTopCities(10),
		getTopCountries(10),
		experience.city_id ? getCitySearchCategories(experience.city_id, 12) : Promise.resolve({ rows: [] }),
	]);
	return {
		photosResult,
		reviewsResult,
		relatedResult,
		popularDestinations: { cities: cities.rows, countries: countries.rows },
		headerSuggestions: experience.city_id ? categories.rows
			.filter((tag) => tag.title.toLowerCase() !== "все")
			.slice(0, 10)
			.map((tag) => ({
				title: tag.title,
				subtitle: "Рубрика",
				count: tag.count,
				countLabel: tag.count % 10 === 1 && tag.count % 100 !== 11 ? "экскурсия"
					: tag.count % 10 >= 2 && tag.count % 10 <= 4 && (tag.count % 100 < 12 || tag.count % 100 > 14) ? "экскурсии" : "экскурсий",
				href: tag.url,
			})) : undefined,
	};
}

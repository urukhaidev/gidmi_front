/**
 * Barrel re-export — every public function and type available from one import.
 *
 * Pages import from `"../lib/travel-db.js"` (the .js extension is required by
 * Astro / ESM resolution even though the source is .ts).
 */

// Types
export type {
	CityDetailRow,
	CityRow,
	CityTopRow,
	CountryRow,
	CountryTopRow,
	ExperienceFilters,
	ExperiencePhotoRow,
	ExperienceRow,
	ExperienceStatsRow,
	GuideFilters,
	GuideRow,
	HomeTravelData,
	QueryResult,
	ReviewFilters,
	ReviewRow,
	SearchResultRow,
	SeoBlockRow,
	TagRow,
} from "./travel-types.js";

// Country queries
export { getCountries, getCountry, getCountryCities, getTopCountries } from "./country-query.js";

// City queries
export { getCities, getCity, getTopCities } from "./city-query.js";

// Experience queries
export {
	getExperience,
	getExperiencePhotos,
	getExperienceStats,
	getExperiences,
	getExperienceTags,
	getPopularExperiences,
} from "./experience-query.js";

// Tag queries
export { getCityTag, getCityTags, getTag, getTags } from "./tag-query.js";

// Guide queries
export { getGuides } from "./guide-query.js";

// SEO blocks
export { getSeoBlock } from "./seo-query.js";
export type { SeoEntityType } from "./seo-query.js";

// Reviews
export { getReviews } from "./review-query.js";

// Search
export { getCitySearchCategories, getCitySearchExperiences, searchTravel } from "./search-query.js";

// URL helpers
export {
	cityCategoryHref,
	cityHref,
	countryHref,
	experienceHref,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// Composite data loaders
// ---------------------------------------------------------------------------

import { getTopCountries } from "./country-query.js";
import { getTopCities } from "./city-query.js";
import { getPopularExperiences } from "./experience-query.js";
import { searchTravel } from "./search-query.js";
import type { HomeTravelData } from "./travel-types.js";

export async function getHomeTravelData(searchText: string, countryLimit = 30, cityLimit = 30): Promise<HomeTravelData> {
	const [countries, cities, experiences, searchResults] = await Promise.all([
		getTopCountries(countryLimit),
		getTopCities(cityLimit),
		getPopularExperiences(),
		searchTravel(searchText),
	]);

	return {
		countries: countries.rows,
		cities: cities.rows,
		experiences: experiences.rows,
		searchResults: searchResults.rows,
		errors: [
			countries.error,
			cities.error,
			experiences.error,
			searchResults.error,
		].filter((e): e is string => e !== null),
	};
}

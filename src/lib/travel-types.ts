/** Typed result wrapper for all Supabase queries. */
export interface QueryResult<T> {
	rows: T[];
	error: string | null;
}

// ---------------------------------------------------------------------------
// Entity interfaces — fields match the SQL column aliases used in queries.
// ---------------------------------------------------------------------------

export interface CountryRow {
	id: string;
	name: string;
	name_en: string | null;
	url: string | null;
	slug: string | null;
	image_url: string | null;
	region: string | null;
	currency: string | null;
	about_obj_phrase: string | null;
	in_obj_phrase: string | null;
	guides_count: number;
	experience_count: number;
}

/** Minimal country projection used in getTopCountries. */
export interface CountryTopRow {
	id: string;
	name: string;
	url: string | null;
	slug: string | null;
	image_url: string | null;
	experience_count: number;
}

export interface CityRow {
	id: string;
	name: string;
	name_en: string | null;
	slug: string | null;
	url: string | null;
	image_url: string | null;
	image_thumbnail: string | null;
	country_id: string | null;
	country_url?: string | null;
	country_slug?: string | null;
	about_obj_phrase: string | null;
	in_obj_phrase: string | null;
	across_obj_phrase: string | null;
	guides_count: number;
	experience_count: number;
}

/** Extended city row returned by getCity — includes joined country fields. */
export interface CityDetailRow extends CityRow {
	country_name: string | null;
	country_url: string | null;
	country_slug: string | null;
}

/** Minimal city projection used in getTopCities. */
export interface CityTopRow {
	id: string;
	name: string;
	slug: string | null;
	url: string | null;
	image_url: string | null;
	country_id: string | null;
	country_name?: string | null;
	country_url: string | null;
	country_slug: string | null;
	experience_count: number;
}

export interface ExperienceRow {
	id: string;
	title: string;
	tagline: string | null;
	annotation: string | null;
	url: string | null;
	image_url: string | null;
	cover_image_url: string | null;
	price_value: number | null;
	price_currency: string | null;
	price_value_string: string | null;
	rating: number | null;
	review_count: number | null;
	duration: string | null;
	max_persons: number | null;
	type: string | null;
	format: string | null;
	movement_type: string | null;
	schedule_type: string | null;
	additional_info: string | null;
	comfort_level_info: string | null;
	price_included_description: string | null;
	price_not_included_description: string | null;
	description_html: string | null;
	description_new_html: string | null;
	meeting_point_text: string | null;
	finish_point_text: string | null;
	schedule_text: string | null;
	languages: string | null;
	city_id: string | null;
	country_id: string | null;
	guide_id: string | null;
	city_slug: string | null;
	country_url: string | null;
	country_slug: string | null;
	city_name: string | null;
	city_in_obj_phrase: string | null;
	country_name: string | null;
	guide_name: string | null;
	guide_avatar: string | null;
	guide_rating: number | null;
	guide_review_count: number | null;
}

export interface ExperiencePhotoRow {
	id: string;
	position: number;
	image_url: string | null;
}

export interface ExperienceStatsRow {
	count: number;
	min_price_value: number | null;
	min_price_currency: string | null;
	review_count: number;
}

export interface TagRow {
	id: string;
	name: string;
	slug: string | null;
	tag_slug: string | null;
	category: string | null;
	tag_category: string | null;
	group_name: string | null;
	term_name: string | null;
	title: string | null;
	header: string | null;
	seo_description: string | null;
	seo_text: string | null;
	group_slug: string | null;
	term_slug: string | null;
	url: string | null;
	image_url: string | null;
	city_id: string | null;
	city_slug: string | null;
	city_name: string | null;
	country_url?: string | null;
	country_slug?: string | null;
	experience_count: number;
}

export interface GuideRow {
	id: string;
	first_name: string | null;
	last_name: string | null;
	url: string | null;
	image_url: string | null;
	rating: number | null;
	review_count: number | null;
	exp_count_published: number | null;
	description: string | null;
	city_id: string | null;
	city_name: string | null;
}

export interface SearchResultRow {
	type: "country" | "city" | "category" | "experience";
	id: string;
	title: string;
	url: string;
	image_url: string | null;
	count: number;
	city_id: string | null;
	city_slug: string | null;
	city_name: string | null;
	country_id: string | null;
	country_url: string | null;
	country_slug: string | null;
}

export interface SeoBlockRow {
	entity_type: "country" | "city" | "city_category";
	entity_id: string;
	h1: string | null;
	title: string | null;
	h2: string;
	body: string;
	faq: string | null;
}

export interface ReviewRow {
	id: string;
	experience_id: string;
	author_name: string | null;
	avatar_url: string | null;
	created_on: string | null;
	rating: number | null;
	text: string | null;
	experience_title: string | null;
	title: string | null;
	city_slug: string | null;
	country_slug: string | null;
	country_url: string | null;
}

// ---------------------------------------------------------------------------
// Filter / option types
// ---------------------------------------------------------------------------

export interface ExperienceFilters {
	limit?: number;
	offset?: number;
	countryId?: string | null;
	cityId?: string | null;
	categoryId?: string | number | null;
	sort?: string;
	persons?: string | number;
	format?: string;
	movement?: string;
	price?: string;
}

export interface GuideFilters {
	countryId?: string | null;
	cityId?: string | null;
	limit?: number;
}

export interface ReviewFilters {
	experienceId?: string | null;
	cityId?: string | null;
	categoryId?: string | number | null;
	limit?: number;
}

export interface HomeTravelData {
	countries: CountryTopRow[];
	cities: CityTopRow[];
	experiences: ExperienceRow[];
	searchResults: SearchResultRow[];
	errors: string[];
}

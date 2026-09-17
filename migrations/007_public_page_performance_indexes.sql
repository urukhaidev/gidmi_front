-- The page queries below filter by city/category and then order a small result
-- set by popularity. These composite indexes let PostgreSQL stop at LIMIT
-- instead of sorting every excursion in the selected city.
create extension if not exists pg_trgm;

create index if not exists experiences_city_popularity_idx
	on public.experiences (
		city_id,
		rating desc nulls last,
		review_count desc nulls last,
		visitors_count desc nulls last,
		id desc
	);

create index if not exists experiences_country_popularity_idx
	on public.experiences (
		country_id,
		rating desc nulls last,
		review_count desc nulls last,
		visitors_count desc nulls last,
		id desc
	);

-- getReviews() needs the newest reviews in one city. Keep city_id with the
-- review so PostgreSQL can stop after LIMIT instead of sorting every review
-- attached to every excursion in that city.
alter table public.experience_reviews
	add column if not exists city_id integer;

update public.experience_reviews r
set city_id = e.city_id
from public.experiences e
where e.id = r.experience_id
	and r.city_id is null;

create or replace function public.set_experience_review_city_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
	select e.city_id
	into new.city_id
	from public.experiences e
	where e.id = new.experience_id;

	return new;
end;
$$;

drop trigger if exists experience_reviews_set_city_id on public.experience_reviews;

create trigger experience_reviews_set_city_id
	before insert or update of experience_id
	on public.experience_reviews
	for each row
	execute function public.set_experience_review_city_id();

drop index if exists public.experience_reviews_nonempty_experience_date_idx;

create index if not exists experience_reviews_city_date_idx
	on public.experience_reviews (
		city_id,
		(coalesce(
			created_at at time zone 'UTC',
			created_on_dt,
			created_on::timestamp
		)) desc,
		id desc
	)
	where nullif(trim(coalesce(text, '')), '') is not null;

-- Separate trigram indexes match the individual autocomplete fields. PostgreSQL
-- cannot index array_to_string(), so lexical triggers remain a fallback term.
create index if not exists tag_category_catalog_main_name_trgm_idx
	on public.tag_category_catalog using gin (main_name gin_trgm_ops);

create index if not exists tag_category_catalog_sub_name_trgm_idx
	on public.tag_category_catalog using gin (sub_name gin_trgm_ops);

create index if not exists tag_category_catalog_title_trgm_idx
	on public.tag_category_catalog using gin (title gin_trgm_ops);

create index if not exists tag_category_catalog_header_trgm_idx
	on public.tag_category_catalog using gin (header gin_trgm_ops);

create index if not exists tag_category_catalog_main_slug_trgm_idx
	on public.tag_category_catalog using gin (main_slug gin_trgm_ops);

create index if not exists tag_category_catalog_sub_slug_trgm_idx
	on public.tag_category_catalog using gin (sub_slug gin_trgm_ops);

analyze public.experiences;
analyze public.experience_reviews;
analyze public.tag_category_catalog;

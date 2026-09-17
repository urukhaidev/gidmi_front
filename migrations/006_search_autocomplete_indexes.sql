create index if not exists experiences_title_trgm_idx
	on public.experiences using gin (title gin_trgm_ops);

create index if not exists tag_category_catalog_city_ids_gin_idx
	on public.tag_category_catalog using gin (city_ids);

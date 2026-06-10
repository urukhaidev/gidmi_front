grant select on public.experience_reviews to emdash_readonly;

drop policy if exists emdash_readonly_select_experience_reviews on public.experience_reviews;

create policy emdash_readonly_select_experience_reviews
	on public.experience_reviews
	for select
	to emdash_readonly
	using (true);

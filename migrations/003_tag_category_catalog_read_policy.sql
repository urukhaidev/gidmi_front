do $$
declare
	table_name text;
	policy_name text;
begin
	foreach table_name in array array[
		'tripster_city_tags',
		'tripster_tags',
		'experience_tags_new',
		'tag_category_catalog',
		'tag_category_links'
	]
	loop
		execute format('grant select on public.%I to emdash_readonly', table_name);

		policy_name := 'Read ' || table_name || ' for emdash readonly';

		if not exists (
			select 1
			from pg_policies
			where schemaname = 'public'
				and tablename = table_name
				and policyname = policy_name
		) then
			execute format(
				'create policy %I on public.%I for select to emdash_readonly using (true)',
				policy_name,
				table_name
			);
		end if;
	end loop;
end $$;

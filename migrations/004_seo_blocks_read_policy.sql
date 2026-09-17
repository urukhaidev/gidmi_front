do $$
declare
	role_name text;
	policy_name text;
begin
	foreach role_name in array array['emdash', 'emdash_readonly']
	loop
		if exists (select 1 from pg_roles where rolname = role_name) then
			execute format('grant select on public.seo_blocks to %I', role_name);

			policy_name := 'Read seo_blocks for ' || role_name;

			if not exists (
				select 1
				from pg_policies
				where schemaname = 'public'
					and tablename = 'seo_blocks'
					and policyname = policy_name
			) then
				execute format(
					'create policy %I on public.seo_blocks for select to %I using (is_active = true)',
					policy_name,
					role_name
				);
			end if;
		end if;
	end loop;
end $$;

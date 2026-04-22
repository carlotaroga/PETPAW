alter table public.pets enable row level security;

drop policy if exists "shelters can insert own pets" on public.pets;
create policy "shelters can insert own pets"
on public.pets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and lower(coalesce(users.role, '')) in ('shelter', 'admin')
      and users.shelter_id = pets.shelter_id
  )
);

drop policy if exists "shelters can update own pets" on public.pets;
create policy "shelters can update own pets"
on public.pets
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and lower(coalesce(users.role, '')) in ('shelter', 'admin')
      and users.shelter_id = pets.shelter_id
  )
)
with check (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and lower(coalesce(users.role, '')) in ('shelter', 'admin')
      and users.shelter_id = pets.shelter_id
  )
);

drop policy if exists "shelters can delete own pets" on public.pets;
create policy "shelters can delete own pets"
on public.pets
for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and lower(coalesce(users.role, '')) in ('shelter', 'admin')
      and users.shelter_id = pets.shelter_id
  )
);

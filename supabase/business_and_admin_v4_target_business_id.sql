-- MI BOLICHE · META, FICHA DEL NEGOCIO Y PANEL ADMINISTRATIVO REAL · CORRECCIÓN 42P13
-- Ejecutar el archivo completo en Supabase SQL Editor.
-- Compatible con la función existente cuyo parámetro se llama target_business_id.
-- Es repetible y no elimina información existente.

begin;

create table if not exists public.business_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  business_type text not null default 'Minimarket',
  rut text,
  phone text,
  address text,
  commune text,
  region text not null default 'Metropolitana',
  weekly_goal numeric(14,2) not null default 1000000 check (weekly_goal >= 10000),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.business_accounts (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  plan_name text not null default 'Prueba gratuita',
  monthly_fee numeric(14,2) not null default 0 check (monthly_fee >= 0),
  payment_state text not null default 'paid'
    check (payment_state in ('paid', 'late', 'unpaid')),
  account_status text not null default 'trialing'
    check (account_status in ('trialing', 'active', 'past_due', 'grace_period', 'suspended', 'canceled', 'archived')),
  trial_ends_at date,
  due_date date,
  last_payment date,
  notes text not null default '',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null,
  business_id uuid references public.businesses(id) on delete set null,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

insert into public.business_profiles (business_id)
select b.id
from public.businesses b
on conflict (business_id) do nothing;

insert into public.business_accounts (
  business_id,
  plan_name,
  monthly_fee,
  payment_state,
  account_status,
  trial_ends_at,
  due_date
)
select
  b.id,
  'Prueba gratuita',
  0,
  'paid',
  'trialing',
  (current_date + 14),
  (current_date + 14)
from public.businesses b
on conflict (business_id) do nothing;

alter table public.business_profiles enable row level security;
alter table public.business_accounts enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on table public.business_profiles from public;
revoke all on table public.business_accounts from public;
revoke all on table public.admin_audit_log from public;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$function$;

create or replace function public.can_access_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_admin();
$function$;

-- PostgreSQL exige conservar el nombre del parámetro al reemplazar una función.
-- El error 42P13 identifica el nombre ya instalado: target_business_id.
create or replace function public.is_business_writable(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.can_access_business($1)
    and coalesce((
      select ba.account_status not in ('suspended', 'canceled', 'archived')
      from public.business_accounts ba
      where ba.business_id = $1
    ), true);
$function$;

drop policy if exists "members read business profiles" on public.business_profiles;
create policy "members read business profiles"
  on public.business_profiles for select to authenticated
  using (public.can_access_business(business_id));

drop policy if exists "admins read business accounts" on public.business_accounts;
create policy "admins read business accounts"
  on public.business_accounts for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "admins read audit log" on public.admin_audit_log;
create policy "admins read audit log"
  on public.admin_audit_log for select to authenticated
  using (public.is_platform_admin());

grant select on table public.business_profiles to authenticated;
grant select on table public.business_accounts to authenticated;
grant select on table public.admin_audit_log to authenticated;

create or replace function public.get_business_profile(p_business_id uuid)
returns table (
  business_id uuid,
  business_name text,
  business_type text,
  administrator_name text,
  rut text,
  phone text,
  address text,
  commune text,
  region text,
  weekly_goal numeric
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.can_access_business(p_business_id) then
    raise exception 'No tienes acceso a este negocio';
  end if;

  insert into public.business_profiles (business_id)
  values (p_business_id)
  on conflict (business_id) do nothing;

  return query
  select
    b.id,
    b.name,
    bp.business_type,
    coalesce(p.full_name, ''),
    coalesce(bp.rut, ''),
    coalesce(bp.phone, ''),
    coalesce(bp.address, ''),
    coalesce(bp.commune, ''),
    bp.region,
    bp.weekly_goal
  from public.businesses b
  join public.business_profiles bp on bp.business_id = b.id
  left join public.profiles p on p.id = auth.uid()
  where b.id = p_business_id;
end;
$function$;

create or replace function public.update_business_profile(
  p_business_id uuid,
  p_business_name text,
  p_business_type text,
  p_administrator_name text,
  p_rut text,
  p_phone text,
  p_address text,
  p_commune text,
  p_region text,
  p_weekly_goal numeric
)
returns table (
  business_id uuid,
  business_name text,
  business_type text,
  administrator_name text,
  rut text,
  phone text,
  address text,
  commune text,
  region text,
  weekly_goal numeric
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_business_writable(p_business_id) then
    raise exception 'El negocio no está habilitado para guardar cambios';
  end if;

  if nullif(trim(p_business_name), '') is null then
    raise exception 'El nombre del negocio es obligatorio';
  end if;

  if nullif(trim(p_administrator_name), '') is null then
    raise exception 'El nombre de la persona administradora es obligatorio';
  end if;

  if p_weekly_goal < 10000 then
    raise exception 'La meta semanal debe ser de al menos $10.000';
  end if;

  update public.businesses
  set name = trim(p_business_name)
  where id = p_business_id;

  update public.profiles
  set full_name = trim(p_administrator_name)
  where id = auth.uid();

  insert into public.business_profiles (
    business_id,
    business_type,
    rut,
    phone,
    address,
    commune,
    region,
    weekly_goal,
    updated_by,
    updated_at
  )
  values (
    p_business_id,
    coalesce(nullif(trim(p_business_type), ''), 'Minimarket'),
    nullif(trim(p_rut), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_commune), ''),
    coalesce(nullif(trim(p_region), ''), 'Metropolitana'),
    p_weekly_goal,
    auth.uid(),
    now()
  )
  on conflict (business_id) do update set
    business_type = excluded.business_type,
    rut = excluded.rut,
    phone = excluded.phone,
    address = excluded.address,
    commune = excluded.commune,
    region = excluded.region,
    weekly_goal = excluded.weekly_goal,
    updated_by = excluded.updated_by,
    updated_at = now();

  return query
  select *
  from public.get_business_profile(p_business_id);
end;
$function$;

create or replace function public.admin_list_businesses()
returns table (
  business_id uuid,
  business_name text,
  owner_name text,
  owner_email text,
  rut text,
  phone text,
  address text,
  commune text,
  region text,
  business_type text,
  plan_name text,
  monthly_fee numeric,
  payment_state text,
  account_status text,
  due_date date,
  last_payment date,
  registered_at timestamptz,
  user_count bigint,
  product_count bigint,
  sale_count bigint,
  sales_volume numeric,
  last_sale_at timestamptz,
  notes text
)
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Acceso exclusivo para administración';
  end if;

  return query
  select
    b.id,
    b.name,
    coalesce(p.full_name, ''),
    coalesce(u.email::text, ''),
    coalesce(bp.rut, ''),
    coalesce(bp.phone, ''),
    coalesce(bp.address, ''),
    coalesce(bp.commune, ''),
    coalesce(bp.region, ''),
    coalesce(bp.business_type, 'Minimarket'),
    coalesce(ba.plan_name, 'Sin plan'),
    coalesce(ba.monthly_fee, 0),
    coalesce(ba.payment_state, 'unpaid'),
    coalesce(ba.account_status, 'trialing'),
    ba.due_date,
    ba.last_payment,
    u.created_at,
    (
      select count(*) + 1
      from public.business_members bm
      where bm.business_id = b.id
    ),
    (
      select count(*)
      from public.products pr
      where pr.business_id = b.id
        and pr.active = true
    ),
    (
      select count(*)
      from public.sales s
      where s.business_id = b.id
        and s.status = 'completed'
    ),
    (
      select coalesce(sum(s.total_amount), 0)
      from public.sales s
      where s.business_id = b.id
        and s.status = 'completed'
    ),
    (
      select max(s.sold_at)
      from public.sales s
      where s.business_id = b.id
        and s.status = 'completed'
    ),
    coalesce(ba.notes, '')
  from public.businesses b
  left join public.business_profiles bp on bp.business_id = b.id
  left join public.business_accounts ba on ba.business_id = b.id
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id
  order by u.created_at desc nulls last, b.name;
end;
$function$;

create or replace function public.admin_update_business_account(
  p_business_id uuid,
  p_account_status text,
  p_payment_state text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Acceso exclusivo para administración';
  end if;

  if p_account_status not in ('trialing', 'active', 'past_due', 'grace_period', 'suspended', 'canceled', 'archived') then
    raise exception 'Estado de cuenta inválido';
  end if;

  if p_payment_state not in ('paid', 'late', 'unpaid') then
    raise exception 'Estado de pago inválido';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Debes indicar el motivo del cambio';
  end if;

  insert into public.business_accounts (
    business_id,
    account_status,
    payment_state,
    updated_by,
    updated_at
  )
  values (
    p_business_id,
    p_account_status,
    p_payment_state,
    auth.uid(),
    now()
  )
  on conflict (business_id) do update set
    account_status = excluded.account_status,
    payment_state = excluded.payment_state,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into public.admin_audit_log (
    admin_user_id,
    business_id,
    action,
    detail
  )
  values (
    auth.uid(),
    p_business_id,
    'Cambio de estado de cuenta',
    format('Cuenta: %s · Pago: %s · Motivo: %s', p_account_status, p_payment_state, trim(p_reason))
  );
end;
$function$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.can_access_business(uuid) from public;
revoke all on function public.get_business_profile(uuid) from public;
revoke all on function public.update_business_profile(uuid,text,text,text,text,text,text,text,text,numeric) from public;
revoke all on function public.admin_list_businesses() from public;
revoke all on function public.admin_update_business_account(uuid,text,text,text) from public;

grant execute on function public.get_business_profile(uuid) to authenticated;
grant execute on function public.update_business_profile(uuid,text,text,text,text,text,text,text,text,numeric) to authenticated;
grant execute on function public.admin_list_businesses() to authenticated;
grant execute on function public.admin_update_business_account(uuid,text,text,text) to authenticated;

notify pgrst, 'reload schema';

commit;

select
  to_regclass('public.business_profiles') is not null as ficha_negocio,
  to_regclass('public.business_accounts') is not null as estado_cuenta,
  to_regprocedure('public.update_business_profile(uuid,text,text,text,text,text,text,text,text,numeric)') is not null as guardar_ficha_meta,
  to_regprocedure('public.admin_list_businesses()') is not null as panel_admin_real,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_business_writable'
      and p.proargtypes = '2950'::oidvector
      and p.proargnames[1] = 'target_business_id'
  ) as funcion_compatible;

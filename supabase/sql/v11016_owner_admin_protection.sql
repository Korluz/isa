-- ISA V11.1.1 (migração registrada originalmente como isa_v11_0_16_owner_admin_protection)
-- Mantém múltiplos administradores e protege a conta do proprietário.

alter table public.profiles
  add column if not exists is_owner boolean not null default false;

comment on column public.profiles.is_owner is
  'Identifica o único administrador proprietário da plataforma.';

do $$
declare
  v_updated integer := 0;
begin
  if not exists (select 1 from public.profiles where is_owner = true) then
    update public.profiles
       set is_owner = true,
           role = 'admin'::public.app_role,
           active = true,
           status = 'active',
           updated_at = now()
     where lower(email) = lower('lucasgonzagabarros2025@gmail.com');

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'Não foi possível identificar com segurança a conta proprietária de Lucas.';
    end if;
  end if;
end
$$;

create unique index if not exists profiles_single_owner_idx
  on public.profiles ((is_owner))
  where is_owner = true;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'profiles_owner_must_be_active_admin'
       and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_owner_must_be_active_admin
      check (
        not is_owner
        or (
          role = 'admin'::public.app_role
          and active = true
          and status = 'active'
        )
      );
  end if;
end
$$;

create or replace function private.protect_profile_access_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- O aplicativo nunca transfere nem remove a propriedade. Uma eventual
  -- transferência deve ser uma operação administrativa explícita no banco.
  if new.is_owner is distinct from old.is_owner
     and auth.uid() is not null then
    raise exception using
      errcode = '42501',
      message = 'A propriedade da plataforma não pode ser alterada pelo aplicativo.';
  end if;

  -- Nem outro administrador nem o próprio proprietário podem desativar por
  -- acidente a conta que garante a administração principal da plataforma.
  if old.is_owner = true
     and auth.uid() is not null
     and (
       new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.status is distinct from old.status
     ) then
    raise exception using
      errcode = '42501',
      message = 'A conta do administrador proprietário não pode ser rebaixada ou bloqueada.';
  end if;

  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.status is distinct from old.status then
    if auth.uid() is not null
       and not coalesce(public.is_admin(), false) then
      raise exception using
        errcode = '42501',
        message = 'Somente um administrador ativo pode alterar papel ou acesso.';
    end if;

    if new.id = auth.uid()
       and (
         new.role is distinct from 'admin'::public.app_role
         or new.active is distinct from true
         or new.status is distinct from 'active'
       ) then
      raise exception using
        errcode = '42501',
        message = 'A própria conta administrativa não pode ser rebaixada ou bloqueada.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_access_fields() from public;
revoke all on function private.protect_profile_access_fields() from anon;
revoke all on function private.protect_profile_access_fields() from authenticated;

drop trigger if exists profiles_protect_access_fields on public.profiles;
create trigger profiles_protect_access_fields
before update of role, active, status, is_owner on public.profiles
for each row
execute function private.protect_profile_access_fields();

create or replace function private.protect_owner_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_owner = true and auth.uid() is not null then
    raise exception using
      errcode = '42501',
      message = 'A conta do administrador proprietário não pode ser excluída.';
  end if;

  return old;
end;
$$;

revoke all on function private.protect_owner_profile_delete() from public;
revoke all on function private.protect_owner_profile_delete() from anon;
revoke all on function private.protect_owner_profile_delete() from authenticated;

drop trigger if exists profiles_protect_owner_delete on public.profiles;
create trigger profiles_protect_owner_delete
before delete on public.profiles
for each row
execute function private.protect_owner_profile_delete();

create or replace function public.admin_reset_user_data(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_admin uuid := auth.uid();
  v_ok boolean := false;
  v_target_email text;
  v_target_is_owner boolean := false;
  v_empty_state jsonb := jsonb_build_object(
    'seller','',
    'catalog',jsonb_build_array(),
    'sales',jsonb_build_array(),
    'lastBackup','',
    'sellerProfile',jsonb_build_object('name','','phone','','email','','team','','notes','','avatarPath','')
  );
begin
  select exists(
    select 1 from public.profiles p
    where p.id=v_admin and p.role::text='admin' and p.active=true and coalesce(p.status,'active')<>'blocked'
  ) into v_ok;
  if not v_ok then raise exception 'Ação permitida apenas para administrador ativo.'; end if;
  if p_target is null then raise exception 'Conta alvo não informada.'; end if;
  if p_target=v_admin then raise exception 'Sua própria conta administrativa não pode ser resetada por esta função.'; end if;

  select email, coalesce(is_owner, false)
    into v_target_email, v_target_is_owner
    from public.profiles
   where id=p_target;
  if v_target_email is null then raise exception 'Conta não encontrada.'; end if;
  if v_target_is_owner then raise exception 'A conta do administrador proprietário não pode ser resetada.'; end if;

  insert into public.app_state(user_id,state,updated_at)
  values(p_target,v_empty_state,now())
  on conflict(user_id) do update set state=excluded.state,updated_at=excluded.updated_at;

  delete from public.contract_signature_requests where seller_id=p_target;

  update public.profiles
  set phone_original=null,
      phone_normalized=null,
      avatar_path=null,
      company=null,
      team=null,
      notes=null,
      updated_at=now()
  where id=p_target;

  return jsonb_build_object('ok',true,'action','reset','user_id',p_target,'email',v_target_email);
end;
$$;

create or replace function public.admin_delete_user_account(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_admin uuid := auth.uid();
  v_ok boolean := false;
  v_target_email text;
  v_target_is_owner boolean := false;
  v_deleted integer := 0;
begin
  select exists(
    select 1 from public.profiles p
    where p.id=v_admin and p.role::text='admin' and p.active=true and coalesce(p.status,'active')<>'blocked'
  ) into v_ok;
  if not v_ok then raise exception 'Ação permitida apenas para administrador ativo.'; end if;
  if p_target is null then raise exception 'Conta alvo não informada.'; end if;
  if p_target=v_admin then raise exception 'Sua própria conta administrativa não pode ser excluída por esta função.'; end if;

  select coalesce(is_owner, false)
    into v_target_is_owner
    from public.profiles
   where id=p_target;
  if v_target_is_owner then raise exception 'A conta do administrador proprietário não pode ser excluída.'; end if;

  select email into v_target_email from auth.users where id=p_target;
  if v_target_email is null then raise exception 'Conta de autenticação não encontrada.'; end if;

  delete from auth.users where id=p_target;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('ok',v_deleted=1,'action','delete','user_id',p_target,'email',v_target_email);
end;
$$;

revoke execute on function public.admin_reset_user_data(uuid) from public, anon;
grant execute on function public.admin_reset_user_data(uuid) to authenticated;

revoke execute on function public.admin_delete_user_account(uuid) from public, anon;
grant execute on function public.admin_delete_user_account(uuid) to authenticated;

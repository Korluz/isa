-- ISA V11.0.12
-- Impede que uma conta comum altere os próprios campos de autorização.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function private.protect_profile_access_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.status is distinct from old.status then
    if not coalesce(public.is_admin(), false) then
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

-- Função de trigger legada: continua como defesa adicional, mas não é uma RPC.
revoke all on function public.protect_profile_privileged_fields() from public;
revoke all on function public.protect_profile_privileged_fields() from anon;
revoke all on function public.protect_profile_privileged_fields() from authenticated;

drop trigger if exists profiles_protect_access_fields on public.profiles;
create trigger profiles_protect_access_fields
before update of role, active, status on public.profiles
for each row
execute function private.protect_profile_access_fields();

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
  and role = 'seller'::public.app_role
  and active = true
  and status = 'active'
);

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.admin_reset_user_data(uuid) from public, anon;
grant execute on function public.admin_reset_user_data(uuid) to authenticated;

revoke execute on function public.admin_delete_user_account(uuid) from public, anon;
grant execute on function public.admin_delete_user_account(uuid) to authenticated;

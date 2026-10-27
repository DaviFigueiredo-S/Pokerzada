create or replace function poker_private.poker_auth_created() returns trigger language plpgsql security definer set search_path='' as $$
declare uname text; principal boolean;
begin
 if exists(select 1 from public.poker_accounts where user_id=new.id) then return new;end if;
 if coalesce(new.raw_app_meta_data->>'poker_account','')<>'true' then return new;end if;
 uname:=new.raw_app_meta_data->>'poker_username';
 if coalesce(uname,'')!~'^[A-Za-z0-9_]{3,32}$' then raise exception 'Nome de usuário inválido';end if;
 principal:=coalesce(new.raw_app_meta_data->>'poker_bootstrap','')='true';
 if principal is distinct from (lower(uname)='davi303') then raise exception 'Conta principal reservada';end if;
 insert into public.poker_accounts(user_id,display_name,username,role,approved,must_change_password)
 values(new.id,uname,uname,case when principal then 'owner' else 'member' end,principal,principal and coalesce(new.raw_app_meta_data->>'poker_password_permanent','')<>'true');
 return new;
end;$$;
drop trigger poker_account_created on auth.users;
create trigger poker_account_created after insert or update of raw_app_meta_data on auth.users for each row execute function poker_private.poker_auth_created();
-- Recupera cadastros sem vínculo; mantém todas as identidades e senhas.
with candidates as (
 select u.*,row_number() over(partition by lower(raw_app_meta_data->>'poker_username') order by created_at desc,id desc) n
 from auth.users u where raw_app_meta_data->>'poker_account'='true'
 and not exists(select 1 from public.poker_accounts a where a.user_id=u.id)
), named as (
 select *,case when n=1 and not exists(select 1 from public.poker_accounts a where lower(a.username)=lower(raw_app_meta_data->>'poker_username')) then raw_app_meta_data->>'poker_username'
 else left(raw_app_meta_data->>'poker_username',15)||'_'||left(replace(id::text,'-',''),12) end resolved
 from candidates where lower(raw_app_meta_data->>'poker_username')<>'davi303'
)
insert into public.poker_accounts(user_id,display_name,username,role,approved,must_change_password)
select id,raw_app_meta_data->>'poker_username',resolved,'member',false,false from named;


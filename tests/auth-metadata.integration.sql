begin;
do $$declare uid uuid:=gen_random_uuid(); duplicate_id uuid:=gen_random_uuid(); uname text:='test_'||left(replace(gen_random_uuid()::text,'-',''),15); failed boolean:=false;
begin
 insert into auth.users(id,email,raw_app_meta_data) values(uid,uid||'@example.invalid','{}');
 assert not exists(select 1 from public.poker_accounts where user_id=uid),'Antes dos metadados';
 update auth.users set raw_app_meta_data=jsonb_build_object('poker_account',true,'poker_username',uname) where id=uid;
 assert exists(select 1 from public.poker_accounts where user_id=uid and username=uname and role='member' and not approved),'Metadados tardios criam vínculo';
 update auth.users set raw_app_meta_data=raw_app_meta_data||'{"provider":"email"}'::jsonb where id=uid;
 assert (select count(*) from public.poker_accounts where user_id=uid)=1,'Atualização não duplica';
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(duplicate_id,duplicate_id||'@example.invalid','{}',jsonb_build_object('poker_account',true,'poker_username','Davi303','poker_bootstrap',true));
 assert not exists(select 1 from public.poker_accounts where user_id=duplicate_id),'Metadados do cliente não concedem poderes';
 begin update auth.users set raw_app_meta_data=jsonb_build_object('poker_account',true,'poker_username',upper(uname)) where id=duplicate_id;
 exception when unique_violation then failed:=true;end;
 assert failed,'Nome duplicado recusado atomicamente';
 if not exists(select 1 from public.poker_accounts where role='owner') then
 update auth.users set raw_app_meta_data=jsonb_build_object('poker_account',true,'poker_username','Davi303','poker_bootstrap',true,'poker_password_permanent',true) where id=duplicate_id;
 assert exists(select 1 from public.poker_accounts where user_id=duplicate_id and role='owner' and approved and not must_change_password),'Principal com senha definitiva';
 end if;
end;$$;
select 'PASS: metadados tardios, idempotência, duplicados, metadados não confiáveis e senha permanente' result;
rollback;

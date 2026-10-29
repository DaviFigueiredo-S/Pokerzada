begin;
set local role service_role;
do $$begin
 assert public.poker_auth_rate('automated-test-limit',2);
 assert public.poker_auth_rate('automated-test-limit',2);
 assert not public.poker_auth_rate('automated-test-limit',2);
 assert not public.poker_auth_rate(null,2);
 assert not public.poker_auth_rate('automated-test-limit',null);
 assert public.poker_auth_lookup('nonexistent_test_user') is null;
end;$$;
reset role;
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.poker_auth_rate('automated-test-limit',2);exception when insufficient_privilege then denied:=true;end;
 assert denied,'Somente serviço usa limitador';
end;$$;
reset role;
select 'PASS: rate limiter, parâmetros nulos, lookup e permissão de serviço; rollback integral' as auth_integration_result;
rollback;


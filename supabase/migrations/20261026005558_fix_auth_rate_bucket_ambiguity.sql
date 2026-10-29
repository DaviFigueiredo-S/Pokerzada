create or replace function poker_private.poker_auth_rate(bucket text,max_attempts integer default 30) returns boolean language plpgsql security definer set search_path='' as $$
declare hits integer;
begin
 if $1 is null or length($1)>200 or $2 is null or $2<1 or $2>1000 then return false;end if;
 delete from poker_private.auth_limits where window_start<now()-interval '2 hours';
 insert into poker_private.auth_limits as lim(bucket,attempts) values($1,1)
 on conflict on constraint auth_limits_pkey do update
 set attempts=case when lim.window_start<now()-interval '1 hour' then 1 else lim.attempts+1 end,
 window_start=case when lim.window_start<now()-interval '1 hour' then now() else lim.window_start end
 returning lim.attempts into hits;
 return hits<=$2;
end;$$;


-- ============================================================================
-- Compences · tiny assertion helpers for the SQL test suite
-- ============================================================================
create schema if not exists test;

create table if not exists test.results (
  id     serial primary key,
  label  text not null,
  passed boolean not null,
  detail text
);

create or replace function test.ok(p_cond boolean, p_label text)
returns void
language plpgsql
as $$
begin
  insert into test.results (label, passed, detail)
  values (p_label, coalesce(p_cond, false),
          case when coalesce(p_cond, false) then null else 'expected true' end);
end;
$$;

create or replace function test.eq(p_actual anyelement, p_expected anyelement, p_label text)
returns void
language plpgsql
as $$
begin
  insert into test.results (label, passed, detail)
  values (
    p_label,
    p_actual is not distinct from p_expected,
    case when p_actual is not distinct from p_expected then null
         else format('expected %L, got %L', p_expected, p_actual) end
  );
end;
$$;

-- Runs a statement and asserts that it fails. Used to prove a guard or a
-- constraint actually bites.
create or replace function test.raises(p_sql text, p_label text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
    insert into test.results (label, passed, detail)
    values (p_label, false, 'statement unexpectedly succeeded');
  exception when others then
    insert into test.results (label, passed, detail) values (p_label, true, sqlerrm);
  end;
end;
$$;

-- Counts rows a `select` returns under whatever role/JWT is currently set.
create or replace function test.visible(p_sql text)
returns bigint
language plpgsql
as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) s', p_sql) into n;
  return n;
end;
$$;

create or replace function test.report()
returns table (total bigint, passed bigint, failed bigint)
language sql
as $$
  select count(*), count(*) filter (where passed), count(*) filter (where not passed)
    from test.results;
$$;

-- Assertions are recorded while the suite is impersonating `authenticated` or
-- `anon`, so those roles need access to the harness itself.
grant usage on schema test to anon, authenticated, service_role;
grant all on all tables in schema test to anon, authenticated, service_role;
grant all on all sequences in schema test to anon, authenticated, service_role;
grant execute on all functions in schema test to anon, authenticated, service_role;
alter default privileges in schema test grant all on tables to anon, authenticated, service_role;
alter default privileges in schema test grant all on functions to anon, authenticated, service_role;

-- Seguridad de la base en Supabase. Idempotente: se puede ejecutar cuantas veces se quiera.
-- La app accede sólo desde el servidor con Prisma (rol postgres, dueño de las tablas y BYPASSRLS),
-- así que RLS sin políticas no la afecta y bloquea por completo la Data API (anon/authenticated).
-- Ejecutar con: pnpm db:security

do $$
declare t record;
begin
  for t in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke usage on schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- Las tablas que cree un `prisma db push` futuro nacen con RLS activo.
create or replace function public.rls_auto_enable() returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
      and schema_name = 'public'
  loop
    begin
      execute format('alter table %s enable row level security', cmd.object_identity);
    exception when others then
      raise log 'rls_auto_enable falló en %: %', cmd.object_identity, sqlerrm;
    end;
  end loop;
end $$;

drop event trigger if exists ensure_rls_on_new_tables;
create event trigger ensure_rls_on_new_tables
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

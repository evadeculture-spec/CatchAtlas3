-- Corrigir o local ou a hora de um ping invalida o snapshot ambiental: volta a "pendente".
create or replace function public.reset_enrichment_on_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.lat is distinct from old.lat or new.lng is distinct from old.lng or new.occurred_at is distinct from old.occurred_at then
    new.enrichment_status := 'pendente';
    new.enrichment_attempts := 0;
    new.enrichment_error := null;
    new.enrichment_started_at := null;
  end if;
  return new;
end $$;
create trigger pings_reset_enrichment before update of lat, lng, occurred_at on public.pings
  for each row execute function public.reset_enrichment_on_change();

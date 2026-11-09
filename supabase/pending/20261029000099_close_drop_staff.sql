-- MIGRACIÓN DE CIERRE. NO ESTÁ EN supabase/migrations A PROPÓSITO: no debe aplicarse junto con
-- las demás. Correrla recién después de verificar la transición (ver docs/autorizacion-roles.md,
-- "Verificaciones previas al cierre") y con aprobación explícita. Es IRREVERSIBLE salvo
-- restaurando una copia de seguridad.

do $$
begin
  if not exists (select 1 from public.profiles where role = 'ceo' and active) then
    raise exception 'No hay un CEO activo: no se retira staff_legacy';
  end if;
end $$;

drop function public.is_staff();      -- falla si alguna política o función todavía depende de ella
drop table public.staff_legacy;

-- Etapa 1, fase 1 (a): método de pago QR y análisis de ventas por método de pago.
--
-- QR es un método de REGISTRO MANUAL: el operador lo elige al confirmar la venta. No hay integración de cobros ni se verifica la
-- acreditación con ninguna entidad. confirm_sale ya lee los métodos de public.payment_methods, así que no se cambia ninguna función.
-- Solo agrega datos y dos funciones de lectura; no cambia tablas, políticas ni permisos existentes. Compatible con las ventas
-- anteriores (sus métodos siguen igual).
--
-- Definiciones (todas sobre public.sales, con los permisos de quien consulta: el empleado ve solo sus ventas; gerente y CEO, todas):
--   operaciones      = cantidad de ventas del período con ese método.
--   facturación      = suma de sales.total de esas ventas (pesos enteros).
--   participación    = facturación del método / facturación total del período (la calcula la pantalla; no se muestra con total 0).
--   mes              = mes calendario en la hora de Río Turbio (America/Argentina/Rio_Gallegos), no en UTC.
-- Las ventas no tienen anulaciones ni devoluciones en el modelo (sales.status solo admite «confirmada»), así que no se descuenta nada.

-- 1. Método QR (posición 6; «otro» sigue deshabilitado en la posición 5).
insert into public.payment_methods (code, label, enabled, position) values ('qr', 'QR', true, 6)
  on conflict (code) do nothing;

-- 2. Ventas por método de pago en un período [p_from, p_to).
create function public.sales_by_payment_method(p_from timestamptz, p_to timestamptz) returns jsonb
  language plpgsql stable security invoker set search_path = ''
  as $$
begin
  if not public.has_role_at_least('empleado') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'Período inválido' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'operations_total', (select count(*) from public.sales s where s.created_at >= p_from and s.created_at < p_to),
    'revenue_total', (select coalesce(sum(s.total), 0) from public.sales s where s.created_at >= p_from and s.created_at < p_to),
    -- Incluye los métodos habilitados y también los deshabilitados que tengan ventas (compatibilidad con registros anteriores).
    'methods', coalesce((
      select jsonb_agg(m order by m.position, m.code)
      from (
        select pm.code, pm.label, pm.position,
               count(s.id)::int as operations,
               coalesce(sum(s.total), 0)::bigint as revenue
        from public.payment_methods pm
        left join public.sales s
          on s.payment_method = pm.code and s.created_at >= p_from and s.created_at < p_to
        where pm.enabled or exists (select 1 from public.sales s2 where s2.payment_method = pm.code)
        group by pm.code, pm.label, pm.position
      ) m
    ), '[]'::jsonb)
  );
end $$;

-- 3. Contador mensual por método de los últimos p_months meses (incluye el mes en curso). Solo devuelve meses y métodos con ventas.
create function public.sales_monthly_by_payment_method(p_months integer default 6) returns jsonb
  language plpgsql stable security invoker set search_path = ''
  as $$
declare
  v_start timestamptz;
begin
  if not public.has_role_at_least('empleado') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'Cantidad de meses inválida (1 a 24)' using errcode = '22023';
  end if;
  v_start := (date_trunc('month', now() at time zone 'America/Argentina/Rio_Gallegos') - make_interval(months => p_months - 1))
             at time zone 'America/Argentina/Rio_Gallegos';
  return coalesce((
    select jsonb_agg(r order by r.month, r.code)
    from (
      select to_char(date_trunc('month', s.created_at at time zone 'America/Argentina/Rio_Gallegos'), 'YYYY-MM') as month,
             s.payment_method as code,
             count(*)::int as operations,
             sum(s.total)::bigint as revenue
      from public.sales s
      where s.created_at >= v_start
      group by 1, 2
    ) r
  ), '[]'::jsonb);
end $$;

revoke execute on function public.sales_by_payment_method(timestamptz, timestamptz), public.sales_monthly_by_payment_method(integer)
  from public, anon;
grant execute on function public.sales_by_payment_method(timestamptz, timestamptz), public.sales_monthly_by_payment_method(integer)
  to authenticated;

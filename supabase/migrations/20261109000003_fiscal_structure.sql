-- Etapa 1, fase 1 (c): estructura PREPARADA del circuito fiscal (ARCA). NO emite nada: solo registra solicitudes, estados y eventos.
--
-- Principios:
--   * Circuito SEPARADO del comprobante interno y de la venta. Registrar una venta no crea ni solicita ningún comprobante fiscal
--     (no hay ningún disparador sobre sales).
--   * Acceso EXCLUSIVO del grupo de desarrollo (public.is_developer()), exigido acá, en la base. El CEO del comercio no lo ve.
--   * Los clientes no escriben las tablas: todo pasa por las funciones de abajo (security definer, que exigen ser de desarrollo).
--   * Nada de secretos en estas tablas: certificados, claves y tokens van en variables de entorno del SERVIDOR, nunca acá. La
--     función fiscal_log_event rechaza cargas útiles que traigan claves con nombres de credenciales.
--   * Producción fiscal APAGADA por defecto: fiscal_settings.production_enabled = false. Solo el propietario puede encenderla
--     (SQL Editor), después de cumplir la lista de verificación de docs/comprobantes.md. Con ella apagada, ninguna función permite
--     solicitar ni emitir en el entorno de producción.
--   * Sin emisión real mientras no existan credenciales y datos fiscales: los estados y el flujo se prueban con un simulador marcado.
--
-- Estados (no hay fila = «no solicitado»): pendiente, en_proceso, emitido, rechazado, error. «Anulado» NO se implementa todavía:
-- exige notas de crédito y no tiene respaldo en el circuito real de esta etapa.
-- Transiciones: pendiente -> en_proceso; en_proceso -> emitido | rechazado | error; error -> pendiente (reintento).
-- Solo agrega tablas y funciones nuevas: no cambia nada existente.

-- 1. Configuración (una sola fila).
create table public.fiscal_settings (
  id boolean primary key default true check (id),
  production_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.fiscal_settings default values;

-- 2. Un comprobante fiscal por venta.
create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales (id) on delete restrict,
  environment text not null default 'homologacion' check (environment in ('homologacion', 'produccion')),
  status text not null default 'pendiente' check (status in ('pendiente', 'en_proceso', 'emitido', 'rechazado', 'error')),
  idempotency_key uuid not null unique,
  doc_type smallint check (doc_type is null or doc_type > 0),
  point_of_sale integer check (point_of_sale is null or point_of_sale > 0),
  number bigint check (number is null or number > 0),
  cae text check (cae is null or cae ~ '^[0-9]{14}$'),
  cae_expires_on date,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_documents_emitido_completo check (
    status <> 'emitido'
    or (doc_type is not null and point_of_sale is not null and number is not null and cae is not null and cae_expires_on is not null)
  )
);
create index fiscal_documents_status_idx on public.fiscal_documents (status);

-- 3. Registro de eventos (solicitudes, respuestas, cambios de estado y errores): de solo agregado.
create table public.fiscal_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.fiscal_documents (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  kind text not null check (kind in ('solicitud', 'cambio_estado', 'solicitud_arca', 'respuesta_arca', 'error')),
  from_status text,
  to_status text,
  environment text not null,
  payload jsonb,
  note text check (note is null or char_length(note) <= 500)
);
create index fiscal_events_document_idx on public.fiscal_events (document_id, id);
create trigger fiscal_events_no_change before update or delete on public.fiscal_events
  for each row execute function public.ledger_no_change();
create trigger fiscal_events_no_truncate before truncate on public.fiscal_events
  for each statement execute function public.ledger_no_change();

-- 4. RLS: lectura solo para el grupo de desarrollo; escritura, ninguna por la API.
alter table public.fiscal_settings enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.fiscal_events enable row level security;
revoke all on public.fiscal_settings, public.fiscal_documents, public.fiscal_events from public, anon, authenticated;
grant select on public.fiscal_settings, public.fiscal_documents, public.fiscal_events to authenticated;
create policy fiscal_settings_read on public.fiscal_settings for select to authenticated
  using ((select public.is_developer()));
create policy fiscal_documents_read on public.fiscal_documents for select to authenticated
  using ((select public.is_developer()));
create policy fiscal_events_read on public.fiscal_events for select to authenticated
  using ((select public.is_developer()));

-- 5. Solicitar la emisión de una venta (idempotente: una venta, un comprobante).
create function public.fiscal_request_issue(p_sale_id uuid, p_idempotency_key uuid, p_environment text default 'homologacion')
  returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_doc public.fiscal_documents;
  v_prod boolean;
begin
  perform public.require_developer();
  if p_environment is null or p_environment not in ('homologacion', 'produccion') then
    raise exception 'Entorno inválido' using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Falta la clave de idempotencia' using errcode = '22023';
  end if;
  select production_enabled into v_prod from public.fiscal_settings;
  if p_environment = 'produccion' and not coalesce(v_prod, false) then
    raise exception 'La emisión fiscal en producción no está habilitada' using errcode = '55000';
  end if;
  if not exists (select 1 from public.sales s where s.id = p_sale_id) then
    raise exception 'Venta inexistente' using errcode = '22023';
  end if;

  select * into v_doc from public.fiscal_documents d where d.sale_id = p_sale_id;
  if found then
    return jsonb_build_object('id', v_doc.id, 'status', v_doc.status, 'environment', v_doc.environment, 'created', false);
  end if;

  begin
    insert into public.fiscal_documents (sale_id, environment, idempotency_key, requested_by)
    values (p_sale_id, p_environment, p_idempotency_key, auth.uid())
    returning * into v_doc;
  exception when unique_violation then
    select * into v_doc from public.fiscal_documents d where d.sale_id = p_sale_id or d.idempotency_key = p_idempotency_key limit 1;
    if v_doc.sale_id <> p_sale_id then
      raise exception 'La clave de idempotencia ya se usó para otra venta' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_doc.id, 'status', v_doc.status, 'environment', v_doc.environment, 'created', false);
  end;

  insert into public.fiscal_events (document_id, actor_id, kind, to_status, environment, note)
  values (v_doc.id, auth.uid(), 'solicitud', v_doc.status, v_doc.environment, 'Solicitud registrada; todavía no se envió nada a ARCA.');
  return jsonb_build_object('id', v_doc.id, 'status', v_doc.status, 'environment', v_doc.environment, 'created', true);
end $$;

-- 6. Cambiar el estado (con transiciones permitidas y bloqueo de la fila contra procesos simultáneos).
create function public.fiscal_transition(p_document_id uuid, p_to text, p_note text default null, p_result jsonb default null)
  returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_doc public.fiscal_documents;
  v_prod boolean;
  v_from text;
begin
  perform public.require_developer();
  select * into v_doc from public.fiscal_documents d where d.id = p_document_id for update;
  if not found then
    raise exception 'Comprobante inexistente' using errcode = '22023';
  end if;
  v_from := v_doc.status;
  if p_to is null or not (
       (v_from = 'pendiente' and p_to = 'en_proceso')
    or (v_from = 'en_proceso' and p_to in ('emitido', 'rechazado', 'error'))
    or (v_from = 'error' and p_to = 'pendiente')
  ) then
    raise exception 'Transición no permitida: % -> %', v_from, coalesce(p_to, '(nulo)') using errcode = '55000';
  end if;
  select production_enabled into v_prod from public.fiscal_settings;
  if v_doc.environment = 'produccion' and p_to in ('en_proceso', 'emitido') and not coalesce(v_prod, false) then
    raise exception 'La emisión fiscal en producción no está habilitada' using errcode = '55000';
  end if;

  if p_to = 'emitido' then
    if p_result is null
       or coalesce(p_result ->> 'cae', '') !~ '^[0-9]{14}$'
       or coalesce(p_result ->> 'doc_type', '') !~ '^[0-9]+$'
       or coalesce(p_result ->> 'point_of_sale', '') !~ '^[0-9]+$'
       or coalesce(p_result ->> 'number', '') !~ '^[0-9]+$'
       or coalesce(p_result ->> 'cae_expires_on', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Faltan datos del comprobante emitido (tipo, punto de venta, número, CAE y vencimiento)' using errcode = '22023';
    end if;
    update public.fiscal_documents set
      status = 'emitido', last_error = null, updated_at = now(),
      doc_type = (p_result ->> 'doc_type')::smallint,
      point_of_sale = (p_result ->> 'point_of_sale')::integer,
      number = (p_result ->> 'number')::bigint,
      cae = p_result ->> 'cae',
      cae_expires_on = (p_result ->> 'cae_expires_on')::date
    where id = p_document_id;
  elsif p_to in ('rechazado', 'error') then
    if p_note is null or btrim(p_note) = '' then
      raise exception 'Hay que indicar el motivo' using errcode = '22023';
    end if;
    update public.fiscal_documents set status = p_to, last_error = left(p_note, 500), updated_at = now() where id = p_document_id;
  else
    update public.fiscal_documents set status = p_to, last_error = null, updated_at = now() where id = p_document_id;
  end if;

  insert into public.fiscal_events (document_id, actor_id, kind, from_status, to_status, environment, note)
  values (p_document_id, auth.uid(), 'cambio_estado', v_from, p_to, v_doc.environment, left(p_note, 500));
  return jsonb_build_object('id', p_document_id, 'from', v_from, 'status', p_to);
end $$;

-- 7. Registrar una solicitud o respuesta de ARCA, o un error (sin credenciales: se rechazan claves con nombres de secretos).
create function public.fiscal_log_event(p_document_id uuid, p_kind text, p_payload jsonb default null, p_note text default null)
  returns bigint
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_doc public.fiscal_documents;
  v_id bigint;
begin
  perform public.require_developer();
  if p_kind is null or p_kind not in ('solicitud_arca', 'respuesta_arca', 'error') then
    raise exception 'Tipo de evento inválido' using errcode = '22023';
  end if;
  select * into v_doc from public.fiscal_documents d where d.id = p_document_id;
  if not found then
    raise exception 'Comprobante inexistente' using errcode = '22023';
  end if;
  if p_payload is not null then
    if pg_column_size(p_payload) > 20000 then
      raise exception 'La carga útil es demasiado grande' using errcode = '22023';
    end if;
    if p_payload::text ~* '"(token|sign|private_?key|certificate|certificado|password|clave|secret)"\s*:' then
      raise exception 'La carga útil no puede incluir credenciales' using errcode = '22023';
    end if;
  end if;
  insert into public.fiscal_events (document_id, actor_id, kind, environment, payload, note)
  values (p_document_id, auth.uid(), p_kind, v_doc.environment, p_payload, left(p_note, 500))
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function
  public.fiscal_request_issue(uuid, uuid, text), public.fiscal_transition(uuid, text, text, jsonb), public.fiscal_log_event(uuid, text, jsonb, text)
  from public, anon;
grant execute on function
  public.fiscal_request_issue(uuid, uuid, text), public.fiscal_transition(uuid, text, text, jsonb), public.fiscal_log_event(uuid, text, jsonb, text)
  to authenticated;

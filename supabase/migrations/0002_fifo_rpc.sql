-- ============================================================================
-- process_stock_out — FIFO deduction RPC
-- Replaces app.js → App.processStockOut() with a transaction-safe equivalent.
--
-- Concurrency: The cursor uses FOR UPDATE, locking each batch row as it is
-- examined. Concurrent calls for the same item serialize per-batch, so two
-- requests can never both consume the last 5 units of a batch.
-- ============================================================================

create or replace function public.process_stock_out(
  p_item_id      bigint,
  p_quantity     numeric,
  p_site_id      bigint,
  p_issue_type   issue_type,
  p_issued_at    date,
  p_description  text default null
) returns jsonb
language plpgsql
security invoker          -- caller's RLS applies
set search_path = public
as $$
declare
  v_available     numeric;
  v_remaining     numeric := p_quantity;
  v_total_cost    numeric := 0;
  v_consume       numeric;
  v_batch         record;
  v_stock_out_id  bigint;
  v_breakdown     jsonb   := '[]'::jsonb;
begin
  ------------------------------------------------------------------ guards --
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number'
      using errcode = '22023';   -- invalid_parameter_value
  end if;

  if not exists (select 1 from public.items where id = p_item_id) then
    raise exception 'Item % does not exist', p_item_id using errcode = '23503';
  end if;

  if not exists (select 1 from public.sites where id = p_site_id) then
    raise exception 'Site % does not exist', p_site_id using errcode = '23503';
  end if;

  ----------------------------------------------------- pre-flight quantity --
  select coalesce(sum(remaining_quantity), 0)
    into v_available
    from public.stock_in
   where item_id = p_item_id
     and remaining_quantity > 0;

  if v_available < p_quantity then
    raise exception
      'Insufficient stock for item %. Available: %, Requested: %',
      p_item_id, v_available, p_quantity
      using errcode = 'P0001';   -- raise_exception → caught as InsufficientStock
  end if;

  ------------------------------------------------------- header row first --
  insert into public.stock_out
    (item_id, quantity, site_id, issue_type, issued_at, description, total_cost, issued_by)
  values
    (p_item_id, p_quantity, p_site_id, p_issue_type, p_issued_at, p_description, 0, auth.uid())
  returning id into v_stock_out_id;

  ------------------------------------------------------------ FIFO cursor --
  -- Iterate oldest first. FOR UPDATE locks the row for the rest of this txn.
  for v_batch in
    select id, remaining_quantity, unit_rate
      from public.stock_in
     where item_id = p_item_id
       and remaining_quantity > 0
     order by received_at asc, id asc
       for update
  loop
    exit when v_remaining <= 0;

    v_consume := least(v_batch.remaining_quantity, v_remaining);

    update public.stock_in
       set remaining_quantity = remaining_quantity - v_consume
     where id = v_batch.id;

    insert into public.stock_out_batches
      (stock_out_id, stock_in_id, quantity_consumed, unit_rate_at_consumption)
    values
      (v_stock_out_id, v_batch.id, v_consume, v_batch.unit_rate);

    v_total_cost := v_total_cost + (v_consume * v_batch.unit_rate);
    v_breakdown  := v_breakdown || jsonb_build_object(
      'stock_in_id', v_batch.id,
      'quantity',    v_consume,
      'unit_rate',   v_batch.unit_rate
    );
    v_remaining := v_remaining - v_consume;
  end loop;

  ------------------------------------------------- defensive serialization --
  -- If something raced past our pre-flight check (unlikely given FOR UPDATE
  -- on the same rows the pre-flight summed, but cheap to verify), abort.
  if v_remaining > 0 then
    raise exception 'Stock changed during transaction; please retry'
      using errcode = '40001';   -- serialization_failure
  end if;

  -- Persist the now-known total cost on the header row.
  update public.stock_out
     set total_cost = round(v_total_cost::numeric, 2)
   where id = v_stock_out_id;

  return jsonb_build_object(
    'stock_out_id', v_stock_out_id,
    'total_cost',   round(v_total_cost::numeric, 2),
    'breakdown',    v_breakdown
  );
end;
$$;

revoke all on function public.process_stock_out(bigint, numeric, bigint, issue_type, date, text) from public;
grant execute on function public.process_stock_out(bigint, numeric, bigint, issue_type, date, text) to authenticated;

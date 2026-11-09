-- Products saved while new products had no Batch ID get one now, in id order, from the shared 'batches' counter
do $$
declare
  product record;
  next_value bigint;
begin
  insert into id_sequences (name, value) values ('batches', 0) on conflict (name) do nothing;
  for product in select id from products where batch is null order by id loop
    update id_sequences set value = value + 1 where name = 'batches' returning value into next_value;
    update products set batch = 'BT-' || lpad(next_value::text, 5, '0') where id = product.id;
  end loop;
end $$;

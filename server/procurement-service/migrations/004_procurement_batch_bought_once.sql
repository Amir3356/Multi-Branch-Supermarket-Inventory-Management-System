-- A Batch ID can be bought once: at most one order (pending or paid) per catalog Batch ID. A failed order doesn't
-- count, so its Batch ID can be bought again. To buy the same product again, the Purchase Officer adds it again on
-- Category & Product, which gives it a new Batch ID.
create unique index if not exists procurements_product_batch_bought_once
  on procurements (product_batch)
  where product_batch is not null and status <> 'failed';

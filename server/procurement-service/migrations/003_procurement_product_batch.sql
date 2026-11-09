-- The catalog Batch ID the Purchase Officer chose for the order (products.batch). The same product may be in a
-- category more than once, each with its own Batch ID, so this says which one was bought. `batch` stays the batch
-- number the stock was received under.
alter table procurements add column if not exists product_batch varchar(50);

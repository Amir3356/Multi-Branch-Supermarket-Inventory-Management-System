-- The same product may now be added to a category more than once: each entry has its own Batch ID (products.batch,
-- unique), which is how the Purchase Officer tells them apart. So category + name no longer has to be unique.
alter table products drop constraint if exists products_category_name_unique;

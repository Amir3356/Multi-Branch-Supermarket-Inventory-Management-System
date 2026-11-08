-- Audit entries now arrive through each service's outbox (audit_outbox) and may be delivered more than once if a
-- delivery is retried. source_key ("<service>:<outbox id>") identifies the delivery, so a repeat is stored only once.
alter table audit_logs add column if not exists source_key varchar(80);
create unique index if not exists audit_logs_source_key_unique on audit_logs (source_key);

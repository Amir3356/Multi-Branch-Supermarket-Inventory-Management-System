-- Cursor (keyset) pagination of the Audit Logs page walks the log newest first by (occurred_at, id)
create index if not exists audit_logs_occurred_at_id_index on audit_logs (occurred_at desc, id desc);

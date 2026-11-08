import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { config } from './config.js'

/**
 * Applies this service's migrations/*.sql files once each, in name order, recorded per service in service_migrations.
 * Every service shares one database, so a global advisory lock makes services that start together migrate one at a
 * time. The files are written IF NOT EXISTS, so they also run safely against the database the Laravel app created.
 *
 * Migrations run as DB_MIGRATE_USERNAME (the owner / admin login). When that differs from DB_USERNAME, the service's
 * own login is then (re)created as a limited role: it may read and write data, but can't alter or drop tables, and
 * on audit_logs may only add and read entries, so neither a bug nor a stolen service password can rewrite history.
 */
export async function runMigrations(service, dir) {
  const admin = new pg.Client({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.migrateUser,
    password: config.db.migratePassword,
    options: '-c TimeZone=UTC',
  })
  await admin.connect()
  try {
    await admin.query("select pg_advisory_lock(hashtext('supermart:migrations'))")
    await admin.query(`create table if not exists service_migrations (
      service varchar(60) not null,
      name varchar(255) not null,
      applied_at timestamp(0) not null default now(),
      primary key (service, name)
    )`)
    // Audit entries waiting to be delivered to reporting-service (see audit() in events.js), shared by every service
    await admin.query(`create table if not exists audit_outbox (
      id bigserial primary key,
      service varchar(60) not null,
      payload jsonb not null,
      created_at timestamptz not null default now(),
      attempts integer not null default 0,
      last_error text
    )`)
    await admin.query('create index if not exists audit_outbox_service_id_index on audit_outbox (service, id)')

    const applied = new Set((await admin.query('select name from service_migrations where service = $1', [service])).rows.map((row) => row.name))
    const files = (await fs.readdir(dir).catch(() => [])).filter((file) => file.endsWith('.sql')).sort()

    let ran = 0
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = await fs.readFile(path.join(dir, file), 'utf8')
      try {
        await admin.query('begin')
        await admin.query(sql)
        await admin.query('insert into service_migrations (service, name) values ($1, $2)', [service, file])
        await admin.query('commit')
        console.log(`${service}: migrated ${file}`)
        ran++
      } catch (error) {
        await admin.query('rollback')
        throw new Error(`${service}: ${file} failed: ${error.message}`)
      }
    }
    if (!ran) console.log(`${service}: nothing to migrate`)

    if (config.db.user !== config.db.migrateUser) await grantServiceLogin(admin)
  } finally {
    await admin.query("select pg_advisory_unlock(hashtext('supermart:migrations'))").catch(() => {})
    await admin.end()
  }
}

/** Creates or updates the services' login (DB_USERNAME) with only the rights the running services need */
async function grantServiceLogin(admin) {
  const role = admin.escapeIdentifier(config.db.user)
  const password = admin.escapeLiteral(config.db.password ?? '')
  const exists = (await admin.query('select 1 from pg_roles where rolname = $1', [config.db.user])).rowCount > 0
  await admin.query(`${exists ? 'alter' : 'create'} role ${role} with login nosuperuser nocreatedb nocreaterole noinherit nobypassrls password ${password}`)

  // Tables stay owned by the admin login, so the service can't alter, drop or disable triggers on any of them
  await admin.query(`grant connect on database ${admin.escapeIdentifier(config.db.database)} to ${role}`)
  await admin.query(`grant usage on schema public to ${role}`)
  await admin.query(`grant select, insert, update, delete on all tables in schema public to ${role}`)
  await admin.query(`grant usage, select, update on all sequences in schema public to ${role}`)
  await admin.query(`revoke truncate, references, trigger on all tables in schema public from ${role}`)

  // The audit log: add and read only. The table's own trigger refuses changes too, for every login.
  if ((await admin.query("select to_regclass('public.audit_logs') as t")).rows[0].t) {
    await admin.query(`revoke update, delete, truncate on audit_logs from ${role}`)
  }
  // Migration bookkeeping belongs to the admin login
  await admin.query(`revoke insert, update, delete on service_migrations from ${role}`)
}

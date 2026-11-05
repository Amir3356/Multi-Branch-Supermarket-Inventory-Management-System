// npm run seed (auth-service): the Owner and ready-to-use staff accounts at one branch (the Owner can still invite more).
// Safe to run again: existing accounts are never overwritten (their password or role may have changed since).
// The users table is created by user-service's migrations, and the staff branch by branch-service: run those first.
import { hashPassword, pool, roleLabel } from '../utils/index.js'

const OWNER = { fullName: 'Amir Siraj', email: 'amirsiraj1995@gmail.com', password: 'AEHJSS36' }

// Already Active, with a password, so they can sign in without an invitation email. The Procurement Officer covers
// every branch and is invited by the Owner instead.
const STAFF_BRANCH = 'Bellema Pharmacy'
const STAFF_PASSWORD = 'AEHJSS36'
const STAFF = [
  { fullName: 'Asefa Geze', email: 'asefageze1995@gmail.com', role: 'pharmacist' },
  { fullName: 'Hasen Siraj', email: 'hasensiraj1995@gmail.com', role: 'cashier' },
]

async function seedOwner() {
  const { rowCount } = await pool.query("select 1 from users where role = 'owner'")
  if (rowCount) return console.log('An Owner account already exists; leaving it unchanged.')
  await pool.query(
    `insert into users (full_name, email, password, role, branch_id, status, email_verified_at, created_at, updated_at)
     values ($1, $2, $3, 'owner', null, 'active', now(), now(), now())`,
    [OWNER.fullName, OWNER.email, await hashPassword(OWNER.password)],
  )
  console.log(`Owner account created for ${OWNER.email}.`)
}

async function seedStaff() {
  // branches belong to branch-service; reading them is fine
  const branch = (await pool.query('select id, name from branches where lower(name) = lower($1)', [STAFF_BRANCH])).rows[0]
  if (!branch) return console.log(`No branch named ${STAFF_BRANCH}; add it on the Branches page, then seed again.`)

  for (const staff of STAFF) {
    const { rowCount } = await pool.query('select 1 from users where email = $1', [staff.email])
    if (rowCount) {
      console.log(`${staff.email} already exists; leaving it unchanged.`)
      continue
    }
    await pool.query(
      `insert into users (full_name, email, password, role, branch_id, status, email_verified_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, 'active', now(), now(), now())`,
      [staff.fullName, staff.email, await hashPassword(STAFF_PASSWORD), staff.role, branch.id],
    )
    console.log(`${roleLabel(staff.role)} account created for ${staff.email} at ${branch.name}.`)
  }
}

try {
  await seedOwner()
  await seedStaff()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}

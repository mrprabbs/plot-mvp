import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

loadEnv({ path: "server/.env" });
loadEnv();

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to start the server");
  }

  return databaseUrl;
}

const useSsl = process.env.NODE_ENV === "production" || getDatabaseUrl().includes("sslmode=require");

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool);

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS owner_payout_accounts (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      stripe_account_id TEXT NOT NULL UNIQUE,
      details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
      charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      delivery_status TEXT NOT NULL DEFAULT 'queued',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parking_lots (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      description TEXT,
      price_per_hour INTEGER NOT NULL,
      total_spots INTEGER NOT NULL,
      operating_hours_open TEXT NOT NULL,
      operating_hours_close TEXT NOT NULL,
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parking_spots (
      id SERIAL PRIMARY KEY,
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id),
      spot_number TEXT NOT NULL,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE(lot_id, spot_number)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      spot_id INTEGER NOT NULL REFERENCES parking_spots(id),
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id),
      driver_user_id INTEGER REFERENCES users(id),
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      cancellation_deadline TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      owner_payout_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      checkout_session_id TEXT,
      payment_intent_id TEXT,
      refund_id TEXT,
      owner_payout_status TEXT NOT NULL DEFAULT 'pending',
      cancelled_at TEXT,
      confirmed_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await pool.query(`ALTER TABLE parking_lots ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id);`);
  await pool.query(`ALTER TABLE parking_lots ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;`);

  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS driver_user_id INTEGER REFERENCES users(id);`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancellation_deadline TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS owner_payout_cents INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_id TEXT;`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS owner_payout_status TEXT NOT NULL DEFAULT 'pending';`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TEXT;`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS confirmed_at TEXT;`);
}

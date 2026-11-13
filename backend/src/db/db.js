import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema.js";

if (process.env.DATABASE_URL) {
  neonConfig.webSocketConstructor = ws;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });

export async function checkDatabase() {
  await pool.query("select 1");
  return true;
}

export async function closeDatabase() {
  await pool.end();
}

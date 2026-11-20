import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { readEnv } from "../src/lib/env";

export function openDatabase() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const { SUPABASE_DB_URL } = readEnv("database-migrate");
  return postgres(SUPABASE_DB_URL, {
    max: 1,
    connect_timeout: 10,
    ssl: { rejectUnauthorized: true },
    onnotice() {},
  });
}

export async function runDatabaseTask(
  name: string,
  task: (sql: ReturnType<typeof openDatabase>) => Promise<void>,
) {
  let sql: ReturnType<typeof openDatabase> | undefined;
  try {
    sql = openDatabase();
    await task(sql);
  } catch (error) {
    // Database errors can include credentials, SQL parameters and connection details.
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const safeCode = typeof code === "string" && /^[A-Z0-9_]{2,30}$/.test(code) ? ` (${code})` : "";
    console.error(`${name} failed${safeCode}. Check SUPABASE_DB_URL and the last step shown.`);
    process.exitCode = 1;
  } finally {
    await sql?.end({ timeout: 5 }).catch(() => {
      console.error("Database connection could not be closed cleanly.");
      process.exitCode = 1;
    });
  }
}

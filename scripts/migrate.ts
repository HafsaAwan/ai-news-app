import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runDatabaseTask } from "./database";

const directory = join(process.cwd(), "supabase", "migrations");

void runDatabaseTask("Migration", async (sql) => {
  const files = (await readdir(directory)).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!files.length) throw new Error("No migration files found");

  for (const name of files) {
    console.log(`Checking ${name}`);
    const migration = await readFile(join(directory, name), "utf8");
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(192191024, 1)`;
      await tx`
        create table if not exists public.migrations_applied (
          id uuid primary key default gen_random_uuid(),
          name text not null unique,
          applied_at timestamptz not null default now()
        )
      `;
      await tx`alter table public.migrations_applied enable row level security`;
      await tx`revoke all on public.migrations_applied from public, anon, authenticated, service_role`;
      const [applied] = await tx`select name from public.migrations_applied where name = ${name}`;
      if (applied) {
        console.log(`Already applied ${name}`);
        return;
      }
      await tx.unsafe(migration).simple();
      await tx`insert into public.migrations_applied (name) values (${name})`;
    });
  }
  console.log("Migration check complete.");
});

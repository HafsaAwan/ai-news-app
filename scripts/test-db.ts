import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { sources } from "../src/lib/source-config";
import { runDatabaseTask } from "./database";

const publicTables = {
  stories: { field: "headline", privateField: "score" },
  digests: { field: "digest_date", privateField: "created_at" },
  weekly_recaps: { field: "intro_text", privateField: "created_at" },
};
const privateTables = ["sources", "raw_items", "story_items", "job_runs", "ai_usage", "migrations_applied"];
const tables = [...Object.keys(publicTables), ...privateTables];
const permissionOnly = process.argv[2] === "permissions";
const rollback = new Error("Rollback M1 test fixtures");

async function rejectsSql(tx: TransactionSql, statement: string, code: string) {
  try {
    await tx.savepoint(async (sp) => {
      await sp.unsafe(statement);
    });
  } catch (error) {
    const actual = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (actual === code) return;
    throw error;
  }
  throw new Error(`Expected SQLSTATE ${code}`);
}

void runDatabaseTask("Database test", async (sql) => {
  if (!permissionOnly) {
    await sql.begin(async (tx) => {
      console.log("Checking required tables and row-level security.");
      const secured = await tx<{ relname: string }[]>`
        select relname from pg_class where relnamespace = 'public'::regnamespace
          and relkind = 'r' and relrowsecurity and relname in ${tx(tables)}
      `;
      assert.deepEqual(secured.map(({ relname }) => relname).sort(), [...tables].sort());
      console.log("Checking seeded sources against the source configuration.");
      const rows = await tx<{ slug: string; enabled: boolean }[]>`
        select slug, enabled from public.sources where slug in ${tx(sources.map(({ slug }) => slug))}
      `;
      console.log(`Found ${rows.length} of ${sources.length} expected source slugs.`);
      assert.deepEqual(
        new Map(rows.map(({ slug, enabled }) => [slug, enabled])),
        new Map(sources.map(({ slug, enabled }) => [slug, enabled])),
      );

      console.log("Checking schema constraints with rollback-only fixtures.");
      const source = randomUUID();
      const raw = randomUUID();
      const story = randomUUID();
      const unpublished = randomUUID();
      const scheduled = randomUUID();
      const pending = randomUUID();
      const url = "https://example.invalid/m1/" + source;
      await tx`insert into public.sources (id, name, slug, homepage_url, tier)
        values (${source}, 'Test source', ${source}, ${url}, 'lab')`;
      await tx`insert into public.raw_items (id, source_id, url, canonical_url, title)
        values (${raw}, ${source}, ${url}, ${url}, 'Test article')`;
      await rejectsSql(tx, `update public.raw_items set ai_relevance = 2 where id = '${raw}'`, "23514");
      await rejectsSql(tx, `insert into public.raw_items (source_id, url, canonical_url, title)
        values ('${source}', '${url}', '${url}', 'Duplicate')`, "23505");
      await rejectsSql(tx, `insert into public.raw_items (source_id, url, canonical_url, title)
        values ('00000000-0000-0000-0000-000000000000', '${url}', '${url}', 'Missing source')`, "23503");
      await tx`insert into public.stories
        (id, slug, canonical_url, primary_source_id, headline, original_title, short_summary,
          tier, read_minutes, verdict, published_at, public_at, enrichment_status)
        values
          (${story}, ${story}, ${url}, ${source}, 'Released', 'Original', 'Summary',
            'lab', 1, 'read', null, now(), 'fallback'),
          (${unpublished}, ${unpublished}, ${url}, ${source}, 'Unpublished', 'Original', 'Summary',
            'lab', 1, 'read', now() - interval '1 day', default, 'done'),
          (${scheduled}, ${scheduled}, ${url}, ${source}, 'Scheduled', 'Original', 'Summary',
            'lab', 1, 'read', now() - interval '1 day', now() + interval '1 day', 'done'),
          (${pending}, ${pending}, ${url}, ${source}, 'Pending', 'Original', 'Summary',
            'lab', 1, 'read', now() - interval '1 day', now(), 'pending')`;
      await rejectsSql(tx, `update public.stories set topics = '{models,agents,research,policy}'
        where id = '${story}'`, "23514");
      await rejectsSql(tx, `update public.stories set topics = '{fiction}' where id = '${story}'`, "23514");
      await tx`insert into public.story_items (story_id, raw_item_id, is_primary) values (${story}, ${raw}, true)`;
      await rejectsSql(tx, `insert into public.story_items (story_id, raw_item_id)
        values ('${unpublished}', '${raw}')`, "23505");
      const finalDigest = randomUUID();
      const provisionalDigest = randomUUID();
      await tx`
        insert into public.digests (id, digest_date, story_ids, state, finalised_at)
        values (${finalDigest}, current_date - 10000, array[${story}::uuid], 'final', now()),
          (${provisionalDigest}, current_date - 10001, array[${unpublished}::uuid], 'provisional', null)
      `;
      await rejectsSql(tx, `update public.digests set story_ids = '{}' where id = '${finalDigest}'`, "23514");

      const releasedRecap = randomUUID();
      const unpublishedRecap = randomUUID();
      const scheduledRecap = randomUUID();
      const futureWeekRecap = randomUUID();
      await tx`
        with london_week as (
          select date_trunc('week', now() at time zone 'Europe/London')::date as monday
        )
        insert into public.weekly_recaps (id, week_start, intro_text, public_at)
        select ${releasedRecap}::uuid, monday - 7000, 'Released recap', now() from london_week
        union all
        select ${scheduledRecap}::uuid, monday - 7007, 'Scheduled recap', now() + interval '1 day' from london_week
        union all
        select ${futureWeekRecap}::uuid, monday + 7000, 'Future week recap', now() from london_week
      `;
      await tx`
        insert into public.weekly_recaps (id, week_start, intro_text)
        values (${unpublishedRecap}, date_trunc('week', now() at time zone 'Europe/London')::date - 7014,
          'Unpublished recap')
      `;

      console.log("Checking anonymous story, digest and weekly recap visibility.");
      await tx`set local role anon`;
      const visibleStories = await tx<{ id: string }[]>`
        select id from public.stories where id in ${tx([story, unpublished, scheduled, pending])}
      `;
      assert.deepEqual(visibleStories.map(({ id }) => id), [story]);
      const visibleDigests = await tx<{ id: string }[]>`
        select id from public.digests where id in (${finalDigest}, ${provisionalDigest})
      `;
      assert.deepEqual(visibleDigests.map(({ id }) => id), [finalDigest]);
      const visibleRecaps = await tx<{ id: string }[]>`
        select id from public.weekly_recaps
        where id in ${tx([releasedRecap, unpublishedRecap, scheduledRecap, futureWeekRecap])}
      `;
      assert.deepEqual(visibleRecaps.map(({ id }) => id), [releasedRecap]);
      throw rollback;
    }).catch((error: unknown) => {
      if (error !== rollback) throw error;
    });
    console.log("Schema and seed checks passed. Fixtures rolled back.");
  }

  await sql.begin(async (tx) => {
    console.log("Checking anonymous permissions.");
    await tx`set local role anon`;
    for (const table of privateTables) {
      await rejectsSql(tx, `select * from public.${table} limit 0`, "42501");
    }
    for (const [table, { field, privateField }] of Object.entries(publicTables)) {
      await tx.unsafe(`select ${field} from public.${table} limit 0`);
      await rejectsSql(tx, `select ${privateField} from public.${table} limit 0`, "42501");
    }
    for (const table of tables) {
      await rejectsSql(tx, `insert into public.${table} (id) select null::uuid where false`, "42501");
      await rejectsSql(tx, `update public.${table} set id = null where false`, "42501");
      await rejectsSql(tx, `delete from public.${table} where false`, "42501");
    }
  });
  console.log("Anonymous permission checks passed. No data changed.");
});

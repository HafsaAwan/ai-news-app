import { classifyPaywall, sources } from "../src/lib/source-config";
import { runDatabaseTask } from "./database";

void runDatabaseTask("Source seed", async (sql) => {
  await sql.begin(async (tx) => {
    for (const source of sources) {
      const classification = classifyPaywall(source.homepageUrl);
      await tx`
        insert into public.sources (name, slug, homepage_url, feed_url, tier, paywall, enabled)
        values (${source.name}, ${source.slug}, ${source.homepageUrl}, ${source.feedUrl},
          ${source.tier}, ${classification === "unknown" ? null : classification}, ${source.enabled})
        on conflict (slug) do update set
          name = excluded.name, homepage_url = excluded.homepage_url, feed_url = excluded.feed_url,
          tier = excluded.tier, paywall = excluded.paywall, enabled = excluded.enabled
      `;
    }
  });
  console.log(`Seeded ${sources.length} sources. ${sources.filter((source) => source.enabled).length} enabled.`);
});

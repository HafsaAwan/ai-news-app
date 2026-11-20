import { z } from "zod";
import sourceData from "../../config/sources.json";
import topicData from "../../config/topics.json";
import keywordData from "../../config/keywords.json";
import paywallData from "../../config/paywall-domains.json";

const httpsUrl = z.url({ protocol: /^https$/ });
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const id = z.enum(["models", "agents", "developer_tools", "products", "research",
  "business", "policy", "safety", "society", "open_source"]);
const unique = (items: readonly string[]) => new Set(items).size === items.length;

export const topics = z.array(z.object({ id, label: z.string().min(1) }))
  .length(id.options.length).refine((items) => unique(items.map((item) => item.id))).parse(topicData);

export const storyTopics = z.array(id).max(3).refine(unique);

export const sources = z.array(z.object({
  name: z.string().min(1),
  slug,
  homepageUrl: httpsUrl,
  feedUrl: httpsUrl.nullable(),
  tier: z.enum(["lab", "curator", "news"]),
  enabled: z.boolean(),
  coverage: z.array(id).refine(unique),
  checkedOn: z.iso.date(),
}).refine((source) => !source.enabled || (source.feedUrl !== null && source.coverage.length > 0)))
  .refine((items) => unique(items.map((item) => item.slug)))
  .refine((items) => unique(items.flatMap((item) => item.feedUrl ?? [])))
  .parse(sourceData);

const signals = z.array(z.string().min(1)).min(1).refine(unique);
export const keywords = z.object({
  strongSignals: signals,
  topicSignals: z.record(id, signals),
}).parse(keywordData);

export const paywallDomains = z.array(z.object({
  domain: z.hostname().refine((host) => host === host.toLowerCase()),
  classification: z.enum(["free", "metered", "paywalled"]),
  evidence: httpsUrl,
  checkedOn: z.iso.date(),
})).refine((items) => unique(items.map((item) => item.domain))).parse(paywallData);

export function classifyPaywall(url: string) {
  const host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  const matches = paywallDomains.filter(({ domain }) => host === domain || host.endsWith(`.${domain}`));
  matches.sort((left, right) => right.domain.length - left.domain.length);
  return matches.at(0)?.classification ?? "unknown";
}

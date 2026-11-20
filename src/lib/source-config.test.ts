import { expect, test } from "vitest";
import { classifyPaywall, keywords, sources, storyTopics, topics } from "./source-config";

test("keeps all approved topic IDs and tracks enabled coverage", () => {
  expect(topics.map(({ id }) => id)).toEqual([
    "models", "agents", "developer_tools", "products", "research", "business",
    "policy", "safety", "society", "open_source",
  ]);
  expect(Object.keys(keywords.topicSignals)).toEqual(topics.map(({ id }) => id));
  expect(new Set(sources.filter(({ enabled }) => enabled).flatMap(({ coverage }) => coverage)))
    .toEqual(new Set(topics.map(({ id }) => id)));
});

test("limits a story to three approved topics", () => {
  expect(storyTopics.safeParse(["research", "open_source", "models"]).success).toBe(true);
  expect(storyTopics.safeParse(["research", "open_source", "models", "agents"]).success).toBe(false);
  expect(storyTopics.safeParse(["made_up"]).success).toBe(false);
});

test("only enabled sources have verified feeds ready for use", () => {
  const active = sources.filter(({ enabled }) => enabled);
  expect(active.length).toBeGreaterThan(0);
  expect(active.every(({ feedUrl, checkedOn }) => feedUrl?.startsWith("https://") && checkedOn)).toBe(true);
  expect(new Set(sources.map(({ slug }) => slug)).size).toBe(sources.length);
});

test("paywall classifications match whole domains and default to unknown", () => {
  expect(classifyPaywall("https://www.wired.com/story/example")).toBe("metered");
  expect(classifyPaywall("https://simonwillison.net/example")).toBe("free");
  expect(classifyPaywall("https://notwired.com/example")).toBe("unknown");
});

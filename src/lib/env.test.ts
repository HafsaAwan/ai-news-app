import { expect, test } from "vitest";
import { readEnv } from "./env";

test("the homepage requires no credentials", () => {
  expect(readEnv("home", {})).toEqual({});
});

test("database errors name invalid variables without revealing their values", () => {
  expect(() => readEnv("database-read", { NEXT_PUBLIC_SUPABASE_URL: "private-value" }))
    .toThrow(/^Missing or invalid environment variables for database-read: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY$/);
});

test("database read accepts the current key or a legacy key with a blank current entry", () => {
  const url = "https://example.supabase.co";
  expect(readEnv("database-read", {
    NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  }).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("publishable");
  expect(readEnv("database-read", {
    NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy",
  }).NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("legacy");
});

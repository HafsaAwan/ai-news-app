import { expect, test } from "vitest";
import { readEnv } from "./env";

test("the homepage requires no credentials", () => {
  expect(readEnv("home", {})).toEqual({});
});

test("database errors name invalid variables without revealing their values", () => {
  expect(() => readEnv("database-read", { NEXT_PUBLIC_SUPABASE_URL: "private-value" }))
    .toThrow(/^Missing or invalid environment variables for database-read: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY$/);
});

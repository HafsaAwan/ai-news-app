import { z } from "zod";

const webUrl = z.url({ protocol: /^https?$/ });
const nonEmpty = z.string().trim().min(1);

const operations = {
  home: z.object({}),
  site: z.object({ SITE_URL: webUrl }),
  "database-read": z.object({
    NEXT_PUBLIC_SUPABASE_URL: webUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
  }),
  "database-write": z.object({
    NEXT_PUBLIC_SUPABASE_URL: webUrl,
    SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  }),
  "database-migrate": z.object({
    SUPABASE_DB_URL: z.url({ protocol: /^postgres(?:ql)?$/ }),
  }),
  feed: z.object({ CONTACT_EMAIL: z.email() }),
  gemini: z.object({ GEMINI_API_KEY: nonEmpty, GEMINI_MODEL: nonEmpty }),
  groq: z.object({ GROQ_API_KEY: nonEmpty, GROQ_MODEL: nonEmpty }),
  openrouter: z.object({ OPENROUTER_API_KEY: nonEmpty, OPENROUTER_MODEL: nonEmpty }),
};

export const envOperation = z.enum(Object.keys(operations) as (keyof typeof operations)[]);

export function requiredEnv(operation: keyof typeof operations) {
  return Object.keys(operations[operation].shape);
}

export function readEnv<Operation extends keyof typeof operations>(
  operation: Operation,
  env: Readonly<Record<string, string | undefined>> = process.env,
): z.output<(typeof operations)[Operation]> {
  const result = operations[operation].safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map(({ path }) => path.join("."));
    throw new Error(`Missing or invalid environment variables for ${operation}: ${fields.join(", ")}`);
  }
  return result.data as z.output<(typeof operations)[Operation]>;
}

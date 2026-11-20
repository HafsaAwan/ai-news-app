import { loadEnvConfig } from "@next/env";
import { envOperation, readEnv, requiredEnv } from "../src/lib/env";

const operation = envOperation.safeParse(process.argv[2] ?? "home");

if (!operation.success) {
  console.error(`Choose an operation: ${envOperation.options.join(", ")}`);
  process.exitCode = 1;
} else {
  const fields = requiredEnv(operation.data);
  console.log(`Environment for ${operation.data}: ${fields.length ? fields.join(", ") : "no variables required"}.`);

  try {
    if (fields.length) loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
    readEnv(operation.data);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Environment check failed.");
    process.exitCode = 1;
  }
}

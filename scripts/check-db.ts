import { runDatabaseTask } from "./database";

void runDatabaseTask("Database connection check", async (sql) => {
  await sql.begin("read only", async (tx) => {
    await tx`select 1`;
  });
  console.log("Database connection OK. No data changed.");
});

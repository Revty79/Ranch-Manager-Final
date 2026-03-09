import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/ranch_manager_final";

declare global {
  var __ranchSqlClient: ReturnType<typeof postgres> | undefined;
}

const sql =
  global.__ranchSqlClient ??
  postgres(connectionString, {
    max: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__ranchSqlClient = sql;
}

export const db = drizzle(sql, { schema });

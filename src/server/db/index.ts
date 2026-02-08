import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not defined — DB 연결이 비활성화됩니다.");
}

// For queries
const queryClient = connectionString ? postgres(connectionString) : null;
export const db = queryClient
  ? drizzle(queryClient, { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);

// For migrations
export const migrationClient = connectionString
  ? postgres(connectionString, { max: 1 })
  : null;

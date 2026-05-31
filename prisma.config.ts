import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the datasource connection URL out of schema.prisma and into
// this config file. The CLI (migrate / studio / db push) uses `datasource.url`,
// while the runtime PrismaClient connects through the pg driver adapter
// (see src/lib/db.ts).
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

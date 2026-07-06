import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;
const usesSqliteUrl =
  databaseUrl?.startsWith("file:") ||
  process.env.SQLITE_DATABASE_URL?.startsWith("file:");
const isSqliteSchema =
  process.argv.some((arg) => arg.includes("schema.sqlite.prisma")) ||
  usesSqliteUrl ||
  !databaseUrl;

export default defineConfig({
  schema: isSqliteSchema
    ? "prisma/schema.sqlite.prisma"
    : "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: isSqliteSchema
      ? "node --import tsx prisma/seed.ts --provider=sqlite"
      : "node --import tsx prisma/seed.ts --provider=postgres",
  },
  datasource: {
    url: isSqliteSchema
      ? (process.env.SQLITE_DATABASE_URL ?? "file:./dev.db")
      : env("DATABASE_URL"),
  },
});

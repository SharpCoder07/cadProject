#!/usr/bin/env node
// One-time, cross-platform (Windows/macOS/Linux): generates the initial migration
// from schema.prisma, appends the search function, then applies it.
// Run against an empty development database:  npm run db:init
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrations = path.join(root, "prisma", "migrations");
const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

const findInit = () => (existsSync(migrations) ? readdirSync(migrations).find((d) => d.endsWith("_init")) : undefined);

if (findInit()) {
  console.log(`Initial migration already exists (${findInit()}). Applying any pending migrations…`);
  run("npx prisma migrate dev");
  process.exit(0);
}

run("npx prisma migrate dev --create-only --name init");
const dir = findInit();
if (!dir) throw new Error("prisma migrate dev did not create an *_init migration");
const sql = readFileSync(path.join(root, "prisma", "sql", "search.sql"), "utf8");
appendFileSync(path.join(migrations, dir, "migration.sql"), `\n-- ── Search ────────────────────────────────────────────────────────\n${sql}`);
run("npx prisma migrate dev");
console.log(`Created and applied prisma/migrations/${dir}`);

import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    console.error("Missing .env.example — cannot bootstrap environment.");
    process.exit(1);
  }
  copyFileSync(examplePath, envPath);
  console.log("Created relay/.env from .env.example (DATABASE_URL included).");
} else {
  console.log("relay/.env already present.");
}

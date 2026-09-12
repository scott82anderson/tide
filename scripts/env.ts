/**
 * Load env for CLI scripts the same way Next.js does: .env.local overrides .env.
 * Import this first in every script.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

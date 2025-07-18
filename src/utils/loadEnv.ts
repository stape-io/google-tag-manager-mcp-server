import path from "path";
import dotenv from "dotenv";
import { log } from "./log";

// Load environment variables from .env file if it exists
export function loadEnv(): void {
  try {
    dotenv.config({
      path: path.resolve(process.cwd(), process.env.ENV_FILE || ".env"),
    });
  } catch (error) {
    log(
      "Note: No .env file found, using environment variables directly.",
      error,
    );
  }
}

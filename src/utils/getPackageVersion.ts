import path from "path";
import fs from "fs";
import { log } from "./log";

export function getPackageVersion(): string {
  let packageVersion = "1.0.0"; // Default version as fallback
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      packageVersion = packageJson.version || packageVersion;
    }
  } catch (error) {
    log("Could not read package.json, using default version:", error);
  }
  return packageVersion;
}

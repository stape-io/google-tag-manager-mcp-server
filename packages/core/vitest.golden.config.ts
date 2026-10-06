import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config.js";

/**
 * Used only by `npm run test:golden:update` to run generateGolden.ts, which
 * isn't a `*.test.ts` file on purpose (see its own comment) so the default
 * `vitest run` (and therefore `npm test`) never touches it.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["src/test/generateGolden.ts"],
    },
  }),
);

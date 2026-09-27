/**
 * Toggle release mode for autolinking.
 *
 * The Expo dev client (dev launcher + developer menu) must not be compiled into
 * a distributed APK, but `expo run:android` needs it. Autolinking is configured
 * through the `expo` key in package.json, which is static JSON, so the release
 * job flips it here before running `expo prebuild`.
 *
 *   PERIOD_TIMER_RELEASE=1 bun scripts/release-mode.mjs   shipping: exclude it
 *   bun scripts/release-mode.mjs                        local dev: include it
 *
 * This is the same switch app.config.js reads, so setting PERIOD_TIMER_RELEASE=1
 * once in a job (see .github/workflows/release.yml) covers both halves.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * All four must be listed. Autolinking resolves dependencies recursively, so
 * the launcher, menu and menu-interface are linked in their own right and
 * excluding only `expo-dev-client` leaves them in the build.
 */
const DEV_CLIENT_PACKAGES = [
  "expo-dev-client",
  "expo-dev-launcher",
  "expo-dev-menu",
  "expo-dev-menu-interface",
];

const release = process.env.PERIOD_TIMER_RELEASE === "1";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const autolinking = { ...(pkg.expo?.autolinking ?? {}) };
autolinking.android = {
  ...(autolinking.android ?? {}),
  exclude: release ? DEV_CLIENT_PACKAGES : [],
};
pkg.expo = { ...(pkg.expo ?? {}), autolinking };

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(
  release
    ? `Release mode: excluding ${DEV_CLIENT_PACKAGES.join(", ")} from autolinking.`
    : "Dev mode: autolinking will include expo-dev-client.",
);

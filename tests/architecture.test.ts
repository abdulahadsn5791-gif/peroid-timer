import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SRC = join(ROOT, "src");
const TESTS = join(ROOT, "tests");
const FAKES = join(TESTS, "fakes");

const FRAMEWORK_PREFIXES = [
  "react",
  "react-native",
  "expo",
  "@react-native",
  "@expo",
  "@safe-area-context",
  "@react-native-community",
  "node:",
  "bun:",
];

const NODE_BUILTINS = new Set([
  "fs",
  "path",
  "os",
  "child_process",
  "stream",
  "net",
  "http",
  "https",
  "tls",
  "zlib",
  "util",
  "events",
  "readline",
  "worker_threads",
  "dgram",
  "string_decoder",
  "punycode",
  "tty",
]);

function listFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

function importSpecifiers(source: string): string[] {
  const out: string[] = [];
  const pattern = /(?:from|import)\s*(?:\(\s*)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) out.push(match[1]);
  return out;
}

function filesUnder(absDir: string): string[] {
  return listFiles(absDir).map((f) => relative(ROOT, f));
}

describe("Architecture: dependency rules", () => {
  test("domain imports nothing outside its own layer", () => {
    for (const file of filesUnder(join(SRC, "domain"))) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const spec of importSpecifiers(source)) {
        if (spec.startsWith(".")) continue; // same-layer relative import
        expect(spec.startsWith("@domain/"), `${file} imports out-of-layer: ${spec}`).toBe(true);
      }
    }
  });

  test("application imports only domain + application (never adapters/framework/Bun)", () => {
    for (const file of filesUnder(join(SRC, "application"))) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const spec of importSpecifiers(source)) {
        const resolved =
          spec.startsWith(".") ? relative(ROOT, resolve(dirname(join(ROOT, file)), spec)) : null;

        expect(
          spec.startsWith("@domain/") || spec.startsWith("@application/") ||
          (resolved !== null && resolved.startsWith("src/domain/")) ||
          (resolved !== null && resolved.startsWith("src/application/")),
          `${file} imports out-of-layer: ${spec}`,
        ).toBe(true);

        for (const prefix of FRAMEWORK_PREFIXES) {
          expect(spec.startsWith(prefix), `${file} imports framework: ${spec}`).toBe(false);
        }
        expect(NODE_BUILTINS.has(spec), `${file} imports Node builtin: ${spec}`).toBe(false);
      }
    }
  });

  test("nothing imports @adapters except the composition root", () => {
    for (const file of filesUnder(SRC)) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const spec of importSpecifiers(source)) {
        if (!spec.startsWith("@adapters/")) continue;
        expect(
          file === "src/composition-root.ts",
          `${file} imports adapters: ${spec}`,
        ).toBe(true);
      }
    }
  });

  test("tests import only domain/application/runtime/fakes — never adapters", () => {
    for (const file of filesUnder(TESTS)) {
      if (relative(ROOT, file) === "tests/architecture.test.ts") continue; // this file scans itself
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const spec of importSpecifiers(source)) {
        if (spec.startsWith("@tests/") || spec.startsWith(".")) continue;
        expect(
          spec.startsWith("@domain/") || spec.startsWith("@application/") || spec === "bun:test",
          `${file} imports out-of-layer: ${spec}`,
        ).toBe(true);
      }
    }
  });

  test("every outbound port has an in-memory fake in tests/fakes", () => {
    const fakeSources = listFiles(FAKES).map((f) => readFileSync(f, "utf8")).join("\n");
    const ports = listFiles(join(SRC, "application", "ports", "outbound")).map((f) =>
      relative(ROOT, f).split("/").pop()!.replace(/\.ts$/, ""),
    );

    expect(ports.length).toBeGreaterThanOrEqual(6);
    for (const port of ports) {
      expect(fakeSources.includes(`implements ${port}`), `no fake for outbound port ${port}`).toBe(true);
    }
  });
});
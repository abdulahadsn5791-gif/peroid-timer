// Ambient types for Bun tooling (bun test runner, scripts using the Bun API).
// bun-types ships at the project root rather than under @types/, so reference
// the relevant declaration files by path; @types/node supplies node:fs /
// node:path typing for the architecture test.
/// <reference path="./node_modules/bun-types/bun.d.ts" />
/// <reference path="./node_modules/bun-types/test.d.ts" />
/// <reference path="./node_modules/bun-types/test-globals.d.ts" />
/// <reference path="./node_modules/bun-types/globals.d.ts" />
/// <reference types="node" />
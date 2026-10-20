const assert = require("node:assert/strict");
const ts = require("typescript");
const vm = require("node:vm");
const fs = require("node:fs");
const mod = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/lib/license-schedule.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: mod.exports, Date, Intl },
);
const { billingSchedule: s } = mod.exports;
assert.equal(s("2026-11-15", "2027-02-14", 500, 10).length, 3);
assert.equal(s("2026-11-01", "2027-04-30", 500, 10).length, 6);
assert.equal(s("2026-11-01", "2027-10-31", 500, 10).length, 12);
assert.equal(s("2026-11-01", "2028-04-30", 500, 10).length, 18);
assert.equal(s("2026-11-15", "2026-11-15", 500, 15).length, 1);
const jan = s("2028-01-31", "2028-04-29", 500, 31);
assert.equal(jan.length, 3);
assert.equal(jan[1].vencimento, "2028-02-29");
assert.equal(jan[2].ciclo, "2028-03-31");
assert.equal(
  s("2026-11-15", "2027-02-14", 500, 10)[0].vencimento,
  "2026-12-10",
);
for (const args of [
  ["bad", "2027-01-01", 500, 10],
  ["2026-02-30", "2027-01-01", 500, 10],
  ["2027-01-01", "2026-01-01", 500, 10],
  ["2026-01-01", "2027-01-01", 0, 10],
  ["2026-01-01", "2027-01-01", 500, 32],
  ["2026-01-01", "2036-01-01", 500, 10],
])
  assert.equal(s(...args).length, 0);
console.log(
  "Schedule: mid-month cycles, 6/12/18 months, leap year, short months, due day, invalid inputs passed.",
);

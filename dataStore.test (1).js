const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

test("repozytorium nie zawiera nieusuniętych znaczników konfliktu Git", () => {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  const markers = /^(<<<<<<<|=======|>>>>>>>)/m;
  const conflicts = files.filter(file => {
    try {
      return markers.test(require("node:fs").readFileSync(file, "utf8"));
    } catch {
      return false;
    }
  });
  assert.deepEqual(conflicts, [], `Znaleziono znaczniki konfliktu w: ${conflicts.join(", ")}`);
});

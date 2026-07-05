import { test, expect, describe } from "bun:test";
import { runPublish } from "../../src/publish/publish.js";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";

const FIX = join(import.meta.dir, "fixtures");
const OK = join(FIX, "ok");

function cleanup(dir: string) {
  for (const f of ["Ok.json", "publish.json"]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
}

describe("runPublish (dry-run, без тестов)", () => {
  test("валидный сценарий: ok=true, ничего не пишется", async () => {
    cleanup(OK);
    const r = await runPublish({ scenarioDir: OK, rootDir: FIX, write: false, runTests: false, allowMissingChangelog: false });
    expect(r.ok).toBe(true);
    expect(r.wrote).toBe(false);
    expect(existsSync(join(OK, "Ok.json"))).toBe(false);
    const gen = r.generated.find((g) => g.path.endsWith("Ok.json"));
    expect(gen).toBeTruthy();
  });

  test("write=true пишет JSON и publish.json", async () => {
    cleanup(OK);
    const r = await runPublish({ scenarioDir: OK, rootDir: FIX, write: true, runTests: false, allowMissingChangelog: false });
    expect(r.ok).toBe(true);
    expect(r.wrote).toBe(true);
    expect(existsSync(join(OK, "Ok.json"))).toBe(true);
    expect(existsSync(join(OK, "publish.json"))).toBe(true);
    cleanup(OK);
  });
});

describe("runPublish собирает ошибки, не прерываясь", () => {
  test("неподдерживаемая конструкция + отсутствие changelog => >=2 ошибки, ничего не пишется", async () => {
    const BAD = join(FIX, "bad");
    const r = await runPublish({ scenarioDir: BAD, rootDir: FIX, write: true, runTests: false, allowMissingChangelog: false });
    expect(r.ok).toBe(false);
    expect(r.wrote).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain("unsupported");
    expect(codes).toContain("changelog-missing");
    expect(existsSync(join(BAD, "Bad.json"))).toBe(false);
  });
});

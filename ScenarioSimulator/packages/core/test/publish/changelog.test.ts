import { test, expect, describe } from "bun:test";
import { resolveVersion, checkChangelog } from "../../src/publish/changelog.js";

describe("resolveVersion", () => {
  test("один логический => его версия", () => {
    expect(resolveVersion([{ version: "2.0" }]).version).toBe("2.0");
  });
  test("несколько с primary => версия primary", () => {
    expect(resolveVersion([{ version: "1.1" }, { version: "7.0", primary: true }]).version).toBe("7.0");
  });
  test("несколько без primary, версии равны => она же", () => {
    expect(resolveVersion([{ version: "3.0" }, { version: "3.0" }]).version).toBe("3.0");
  });
  test("несколько разных без primary => null + ошибка", () => {
    const r = resolveVersion([{ version: "1.1" }, { version: "7.0" }]);
    expect(r.version).toBeNull();
    expect(r.issues[0]?.code).toBe("version-ambiguous");
  });
  test("нет логических => manifestVersion", () => {
    expect(resolveVersion([], "5.0").version).toBe("5.0");
  });
  test("нет ничего => null без ошибки", () => {
    const r = resolveVersion([]);
    expect(r.version).toBeNull();
    expect(r.issues).toEqual([]);
  });
});

describe("checkChangelog", () => {
  const readmeA = `# S\n## 🕘 История изменений\n### Версия 3.0 (текущая)\n- a\n### Версия 3.1\n- b`;
  const readmeB = `# История изменений:\n## 6.0\n- x\n## 5.1\n- y`;
  test("формат '### Версия 3.1' находится", () => {
    expect(checkChangelog(readmeA, "3.1")).toEqual([]);
  });
  test("формат '## 6.0' находится", () => {
    expect(checkChangelog(readmeB, "6.0")).toEqual([]);
  });
  test("версия 7.0 отсутствует => ошибка", () => {
    const issues = checkChangelog(readmeB, "7.0");
    expect(issues[0]?.severity).toBe("error");
    expect(issues[0]?.code).toBe("changelog-missing");
  });
  test("не путает 3.1 с 3.10", () => {
    expect(checkChangelog(`## 3.10\n- z`, "3.1")[0]?.code).toBe("changelog-missing");
  });
});

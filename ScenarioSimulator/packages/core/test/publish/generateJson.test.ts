import { test, expect, describe } from "bun:test";
import { buildScenarioJson, serializeScenarioJson } from "../../src/publish/generateJson.js";

describe("buildScenarioJson", () => {
  test("LOGIC: поля из info, onStart по умолчанию true", () => {
    const tpl = buildScenarioJson({
      type: "LOGIC",
      source: "info={}\nfunction trigger(){}",
      info: { name: "Term", description: "d", version: "2.0" },
      manifestFile: { source: "source/T.js" },
      folderName: "Term",
    });
    expect(tpl).toEqual({ name: "Term", desc: "d", active: true, onStart: true, sync: false, data: "info={}\nfunction trigger(){}", type: "LOGIC" });
  });

  test("LOGIC: onStart:false из info сохраняется", () => {
    const tpl = buildScenarioJson({ type: "LOGIC", source: "x", info: { name: "N", onStart: false }, manifestFile: { source: "s" }, folderName: "F" });
    expect(tpl.onStart).toBe(false);
  });

  test("GLOBAL: onStart не эмитится, name из манифеста", () => {
    const tpl = buildScenarioJson({ type: "GLOBAL", source: "g", info: {}, manifestFile: { source: "s", name: "Циркадное. Глобальный" }, folderName: "Circ" });
    expect(tpl.name).toBe("Циркадное. Глобальный");
    expect("onStart" in tpl).toBe(false);
    expect(tpl.type).toBe("GLOBAL");
  });

  test("GLOBAL: name из существующего JSON, затем имя папки", () => {
    const withExisting = buildScenarioJson({ type: "GLOBAL", source: "g", info: {}, manifestFile: { source: "s" }, existingJson: { name: "Старое", desc: "od", active: true, sync: false, data: "old", type: "GLOBAL" }, folderName: "Circ" });
    expect(withExisting.name).toBe("Старое");
    expect(withExisting.desc).toBe("od");
    const noExisting = buildScenarioJson({ type: "GLOBAL", source: "g", info: {}, manifestFile: { source: "s" }, folderName: "Circ" });
    expect(noExisting.name).toBe("Circ");
    expect(noExisting.desc).toBe("");
  });
});

describe("serializeScenarioJson", () => {
  test("2 пробела, обёртка scenarioTemplate, порядок ключей", () => {
    const out = serializeScenarioJson({ name: "N", desc: "d", active: true, onStart: true, sync: false, data: "x", type: "LOGIC" });
    expect(out.startsWith('{\n  "scenarioTemplate": {')).toBe(true);
    const idx = (k: string) => out.indexOf(`"${k}"`);
    expect(idx("name")).toBeLessThan(idx("desc"));
    expect(idx("desc")).toBeLessThan(idx("active"));
    expect(idx("active")).toBeLessThan(idx("onStart"));
    expect(idx("onStart")).toBeLessThan(idx("sync"));
    expect(idx("sync")).toBeLessThan(idx("data"));
    expect(idx("data")).toBeLessThan(idx("type"));
  });

  test("GLOBAL: ключа onStart нет", () => {
    const out = serializeScenarioJson({ name: "N", desc: "", active: true, sync: false, data: "x", type: "GLOBAL" });
    expect(out.includes('"onStart"')).toBe(false);
  });
});

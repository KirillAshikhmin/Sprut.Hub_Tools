import { test, expect, describe } from "bun:test";
import { loadManifest, deriveManifest, similarity } from "../../src/publish/manifest.js";
import { join } from "node:path";

const FIX = join(import.meta.dir, "fixtures");

describe("loadManifest", () => {
  test("читает существующий publish.json", async () => {
    const m = await loadManifest(join(FIX, "manual"));
    expect(m?.archive).toBe("manual.zip");
    expect(m?.files.find((f) => f.primary)?.source).toBe("source/Логический.js");
  });
  test("нет файла => null", async () => {
    expect(await loadManifest(join(FIX, "nope"))).toBeNull();
  });
});

describe("similarity", () => {
  test("общие идентификаторы дают высокий скор", () => {
    const a = "function getModes(){} function convert(x){ return x }";
    const b = "function getModes(){} function convert(y){ return y }";
    expect(similarity(a, b)).toBeGreaterThan(0.5);
  });
  test("разный код — низкий скор", () => {
    expect(similarity("function alpha(){}", "function omega(){}")).toBeLessThan(0.5);
  });
});

describe("deriveManifest", () => {
  test("LOGIC матчится к существующему JSON по info.name; GLOBAL — по содержимому", async () => {
    const sources = [
      { path: "/s/source/Логический.js", text: `info = { name: "Основной", version: "7.0" }\nfunction trigger(){ helperX() }` },
      { path: "/s/source/Глоб.js", text: `function helperX(){ return 1 }` },
    ];
    // deriveManifest читает файлы сам — здесь используем фикстуру-каталог (см. Step 4).
    const m = await deriveManifest({
      scenarioDir: join(FIX, "derive"),
      sourceFiles: [join(FIX, "derive/source/Логический.js"), join(FIX, "derive/source/Глоб.js")],
      existingJsons: [
        { file: join(FIX, "derive/Основной.json"), tpl: { name: "Основной", desc: "", active: true, onStart: true, sync: false, data: "old", type: "LOGIC" } },
        { file: join(FIX, "derive/Пакет. Глоб.json"), tpl: { name: "Пакет. Глоб", desc: "", active: true, sync: false, data: "function helperX(){ return 1 }", type: "GLOBAL" } },
      ],
      folderName: "derive",
    });
    const logic = m.files.find((f) => f.source.endsWith("Логический.js"))!;
    const glob = m.files.find((f) => f.source.endsWith("Глоб.js"))!;
    expect(logic.json).toBe("Основной.json");
    expect(logic.primary).toBe(true);
    expect(glob.json).toBe("Пакет. Глоб.json");
    expect(glob.name).toBe("Пакет. Глоб");
  });
});

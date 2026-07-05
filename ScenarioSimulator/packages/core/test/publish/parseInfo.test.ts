import { test, expect, describe } from "bun:test";
import { parseInfo } from "../../src/publish/parseInfo.js";

describe("parseInfo", () => {
  test("извлекает литеральные поля", () => {
    const r = parseInfo(`info = { name: "T", description: "d", version: "2.0", onStart: true, active: false, sync: true }`);
    expect(r.present).toBe(true);
    expect(r.fields).toEqual({ name: "T", description: "d", version: "2.0", onStart: true, active: false, sync: true });
    expect(r.nonLiteralFields).toEqual([]);
  });

  test("шаблонная строка без подстановок читается как строка", () => {
    const r = parseInfo("info = { name: `Hi` }");
    expect(r.fields.name).toBe("Hi");
  });

  test("не-литеральные поля попадают в nonLiteralFields", () => {
    const r = parseInfo(`info = { name: SOME_VAR, version: "1.0" }`);
    expect(r.fields.version).toBe("1.0");
    expect(r.nonLiteralFields).toContain("name");
  });

  test("var info с динамическими values не мешает читать name", () => {
    const r = parseInfo(`var info = { name: "V", options: { p: { values: getList() } } }`);
    expect(r.fields.name).toBe("V");
  });

  test("нет info => present:false", () => {
    const r = parseInfo(`function helper(){}`);
    expect(r.present).toBe(false);
  });

  test("резолвит IDENT.prop на верхнеуровневый объект-литерал", () => {
    const src = `let d = { ru: "русское описание", en: "en" }\ninfo = { name: "N", description: d.ru, version: "1.0" }`;
    const r = parseInfo(src);
    expect(r.fields.description).toBe("русское описание");
    expect(r.nonLiteralFields).not.toContain("description");
  });
  test("ссылка на неизвестный объект => nonLiteral", () => {
    const r = parseInfo(`info = { name: "N", description: missing.ru, version: "1.0" }`);
    expect(r.nonLiteralFields).toContain("description");
  });
});

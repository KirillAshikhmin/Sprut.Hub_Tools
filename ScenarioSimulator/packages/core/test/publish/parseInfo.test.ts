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

  test("конкатенация строки с вызовом функции берёт литеральную часть", () => {
    const src = `let n = { ru: "Датчик " + getList(), en: "Sensor " + getList() }\ninfo = { name: n.ru, description: "d", version: "1.0" }`;
    const r = parseInfo(src);
    expect(r.fields.name).toBe("Датчик ");
    expect(r.nonLiteralFields).not.toContain("name");
  });
  test("bare IDENT на объект {ru,en} берёт поле ru", () => {
    const src = `let n = { ru: "Имя", en: "Name" }\ninfo = { name: n, description: "d", version: "1.0" }`;
    expect(parseInfo(src).fields.name).toBe("Имя");
  });
  test("bare IDENT на строковую константу", () => {
    const src = `const V = "3.0"\ninfo = { name: "N", description: "d", version: V }`;
    expect(parseInfo(src).fields.version).toBe("3.0");
  });
  test("чистый вызов функции без литеральной части => nonLiteral", () => {
    const r = parseInfo(`info = { name: makeName(), description: "d", version: "1.0" }`);
    expect(r.nonLiteralFields).toContain("name");
  });
  test("циклические ссылки не роняют парсер", () => {
    const src = `let a = { x: b.y }\nlet b = { y: a.x }\ninfo = { name: a.x, description: "d", version: "1.0" }`;
    const r = parseInfo(src);
    expect(r.nonLiteralFields).toContain("name");
  });
});

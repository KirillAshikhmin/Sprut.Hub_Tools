import { test, expect, describe } from "bun:test";
import { createZip } from "../../src/publish/zip.js";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("createZip", () => {
  test("реальная распаковка системным unzip (ASCII-имена) даёт исходное содержимое", () => {
    // ASCII-имена: проверяем, что архив — валидный ZIP, который реально
    // распаковывается системным unzip. Кириллицу тут не берём: старый macOS
    // unzip 6.00 отображает UTF-8-имена как mojibake (это его баг показа, не
    // архива) — корректность кириллических имён проверяем побайтово ниже.
    const zip = createZip([
      { name: "global.json", data: '{"a":1}' },
      { name: "logic.json", data: '{"b":2}' },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "ziptest-"));
    const zipPath = join(dir, "out.zip");
    writeFileSync(zipPath, zip);

    const ex = Bun.spawnSync(["unzip", "-o", zipPath, "-d", join(dir, "ex")]);
    expect(ex.exitCode).toBe(0);
    expect(readFileSync(join(dir, "ex", "global.json"), "utf-8")).toBe('{"a":1}');
    expect(readFileSync(join(dir, "ex", "logic.json"), "utf-8")).toBe('{"b":2}');
  });

  test("имя в UTF-8 с флагом бита 11, байты имени совпадают, без __MACOSX", () => {
    const name = "Глобальный.json";
    const zip = createZip([{ name, data: "{}" }]);
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    // Локальный заголовок: сигнатура и флаг UTF-8 (бит 11 = 0x0800) на смещении 6.
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint16(6, true) & 0x0800).toBe(0x0800);

    // Имя файла в заголовке — ровно UTF-8-байты кириллического имени.
    const nameLen = dv.getUint16(26, true);
    const nameBytes = zip.subarray(30, 30 + nameLen);
    expect(new TextDecoder().decode(nameBytes)).toBe(name);

    // Никакого мусора __MACOSX (Finder добавляет его, наш writer — нет).
    expect(new TextDecoder("latin1").decode(zip)).not.toContain("__MACOSX");
  });

  test("EOCD присутствует, число записей верное", () => {
    const zip = createZip([
      { name: "a.json", data: "1" },
      { name: "b.json", data: "2" },
    ]);
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOff = zip.byteLength - 22;
    expect(dv.getUint32(eocdOff, true)).toBe(0x06054b50);
    expect(dv.getUint16(eocdOff + 10, true)).toBe(2); // всего записей
  });
});

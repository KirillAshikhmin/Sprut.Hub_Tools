import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { ConfigLoader } from "../config/index.js";
import { Runner } from "../runner/index.js";
import { Validator } from "../runtime/Validator.js";
import { detectScenarioType } from "./detectType.js";
import { parseInfo } from "./parseInfo.js";
import { buildScenarioJson, serializeScenarioJson } from "./generateJson.js";
import { checkChangelog, resolveVersion, type LogicVersionInput } from "./changelog.js";
import { createZip } from "./zip.js";
import { deriveManifest, loadManifest } from "./manifest.js";
import type { Issue, ManifestFile, PublishManifest, ScenarioTemplateJson, ScenarioType } from "./types.js";

export interface RunPublishOptions {
  scenarioDir: string;
  rootDir: string;
  write: boolean;
  runTests: boolean;
  allowMissingChangelog: boolean;
  initOnly?: boolean;
}

export interface GeneratedFile {
  path: string;
  bytes: number;
  changed: boolean;
}

export interface PublishResult {
  ok: boolean;
  issues: Issue[];
  generated: GeneratedFile[];
  wroteManifest: boolean;
  manifestPath: string;
  testSummary?: { total: number; passed: number; failed: number };
  wrote: boolean;
}

export async function runPublish(opts: RunPublishOptions): Promise<PublishResult> {
  const { scenarioDir, rootDir } = opts;
  const folderName = basename(scenarioDir);
  const issues: Issue[] = [];
  const generated: GeneratedFile[] = [];
  const manifestPath = join(scenarioDir, "publish.json");

  // --- Манифест: загрузить или вывести ---
  const existingJsons = await readExistingJsons(scenarioDir);
  let manifest = await loadManifest(scenarioDir);
  let manifestDerived = false;
  if (!manifest) {
    const sourceFiles = await collectSourceFiles(scenarioDir, rootDir);
    const zipMembers = await readZipMembersIfAny(scenarioDir);
    manifest = await deriveManifest({ scenarioDir, sourceFiles, existingJsons, folderName, zipMembers });
    manifestDerived = true;
  }

  if (opts.initOnly) {
    let wroteManifest = false;
    if (!manifestDerived) {
      issues.push({ severity: "warning", code: "manifest", message: "publish.json уже существует — не перезаписан (удалите его для пересоздания)" });
    } else if (opts.write) {
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      wroteManifest = true;
    }
    const ok = !issues.some((i) => i.severity === "error");
    return { ok, issues, generated, wroteManifest, manifestPath, wrote: false };
  }

  const validator = new Validator({ mode: "es5+" });
  const logicInputs: LogicVersionInput[] = [];
  type Plan = { mf: ManifestFile; abs: string; text: string; type: ScenarioType; tpl?: ScenarioTemplateJson; outPath: string };
  const plans: Plan[] = [];

  // --- Фаза 1: проверки по каждому файлу ---
  for (const mf of manifest.files) {
    try {
      const abs = join(scenarioDir, mf.source);
      if (!existsSync(abs)) {
        issues.push({ severity: "error", code: "source-missing", message: `Нет исходника: ${mf.source}`, file: mf.source });
        continue;
      }
      const text = await readFile(abs, "utf-8");
      const type = mf.type ?? detectScenarioType(text);

      // 2. Синтаксис + неподдерживаемые конструкции
      const vr = validator.validate(text);
      for (const it of vr.issues) {
        issues.push({
          severity: "error",
          code: it.nodeType === "ParseError" ? "syntax" : "unsupported",
          message: it.message,
          file: mf.source,
          line: it.line,
          column: it.column,
        });
      }

      // 3. Метаданные info (LOGIC/TEMPLATE)
      const parsed = parseInfo(text);
      if (type === "LOGIC") {
        if (!parsed.present) {
          issues.push({ severity: "error", code: "info-missing", message: `Нет блока info в ${mf.source}`, file: mf.source });
        } else {
          for (const req of ["name", "description", "version"] as const) {
            if (parsed.fields[req] === undefined) {
              issues.push({ severity: "error", code: "info-missing", message: `В info нет обязательного поля ${req}`, file: mf.source });
            }
          }
          for (const nl of parsed.nonLiteralFields) {
            issues.push({ severity: "error", code: "info-nonliteral", message: `Поле info.${nl} должно быть литералом`, file: mf.source });
          }
          if (mf.name && parsed.fields.name && mf.name !== parsed.fields.name) {
            issues.push({ severity: "error", code: "manifest", message: `name в манифесте ("${mf.name}") ≠ info.name ("${parsed.fields.name}") в ${mf.source}`, file: mf.source });
          }
        }
        logicInputs.push({ version: parsed.fields.version, primary: mf.primary });
      }

      const ex = existingJsons.find((j) => basename(j.file) === (mf.json ?? `${folderName}.json`))?.tpl ?? null;
      const tpl = buildScenarioJson({ type, source: text, info: parsed.fields, manifestFile: mf, existingJson: ex, folderName });
      const outPath = join(scenarioDir, mf.json ?? `${folderName}.json`);
      plans.push({ mf, abs, text, type, tpl, outPath });

      // 6. Дрейф версии (только LOGIC/TEMPLATE с версией и существующим JSON)
      if (type === "LOGIC" && ex && ex.data.trim() !== text.trim()) {
        const oldV = parseInfo(ex.data).fields.version;
        if (oldV && oldV === parsed.fields.version) {
          issues.push({ severity: "warning", code: "version-drift", message: `Код ${mf.source} изменился, но версия осталась ${oldV} — поднимите версию и добавьте запись в changelog`, file: mf.source });
        }
      }
    } catch (e) {
      issues.push({ severity: "error", code: "internal", message: `Ошибка обработки ${mf.source}: ${(e as Error).message}`, file: mf.source });
    }
  }

  // 5. Коллизии и сироты
  detectCollisions(plans.map((p) => p.outPath), issues);
  detectOrphans(scenarioDir, existingJsons, plans, manifest, issues);

  // 4. Changelog
  const { version, issues: verIssues } = resolveVersion(logicInputs, manifest.version);
  issues.push(...verIssues);
  if (version) {
    const readmePath = join(scenarioDir, "README.md");
    const readme = existsSync(readmePath) ? await readFile(readmePath, "utf-8") : "";
    for (const it of checkChangelog(readme, version)) {
      issues.push(opts.allowMissingChangelog ? { ...it, severity: "warning" } : it);
    }
  }

  // 7. Тесты
  let testSummary: PublishResult["testSummary"];
  if (opts.runTests) {
    try {
      const runner = new Runner();
      const { summary } = await runner.run({ scenarios: [scenarioDir], rootDir });
      testSummary = { total: summary.total, passed: summary.passed, failed: summary.failed };
      if (summary.failed > 0) {
        issues.push({ severity: "error", code: "test-failed", message: `Тесты упали: ${summary.failed} из ${summary.total}` });
      }
    } catch (e) {
      issues.push({ severity: "error", code: "test-failed", message: `Ошибка запуска тестов: ${(e as Error).message}` });
    }
  }

  // --- Фаза 2: решение ---
  const hasErrors = issues.some((i) => i.severity === "error");
  const ok = !hasErrors;

  // Список "что будет сгенерировано" — всегда (для --check/отчёта)
  for (const p of plans) {
    const serialized = serializeScenarioJson(p.tpl!);
    const bytes = Buffer.byteLength(serialized, "utf-8");
    const prev = existsSync(p.outPath) ? await readFile(p.outPath, "utf-8") : "";
    generated.push({ path: p.outPath, bytes, changed: prev !== serialized });
  }

  let wrote = false;
  let wroteManifest = false;
  if (ok && opts.write) {
    for (const p of plans) {
      await writeFile(p.outPath, serializeScenarioJson(p.tpl!));
    }
    if (manifestDerived) {
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      wroteManifest = true;
    }
    await maybeBuildArchive(scenarioDir, manifest, plans, folderName);
    wrote = true;
  }

  return { ok, issues, generated, wroteManifest, manifestPath, testSummary, wrote };
}

async function readExistingJsons(scenarioDir: string): Promise<{ file: string; tpl: ScenarioTemplateJson }[]> {
  const out: { file: string; tpl: ScenarioTemplateJson }[] = [];
  let entries: string[] = [];
  try { entries = await readdir(scenarioDir); } catch { return out; }
  for (const e of entries) {
    if (!e.endsWith(".json") || e === "publish.json") continue;
    try {
      const raw = JSON.parse(await readFile(join(scenarioDir, e), "utf-8"));
      if (raw?.scenarioTemplate?.data !== undefined) out.push({ file: join(scenarioDir, e), tpl: raw.scenarioTemplate });
    } catch { /* пропускаем не-сценарные json */ }
  }
  return out;
}

async function collectSourceFiles(scenarioDir: string, rootDir: string): Promise<string[]> {
  const loader = new ConfigLoader();
  const targets = await loader.findScenarios(rootDir, [scenarioDir]);
  const set = new Set<string>();
  for (const t of targets) {
    const cfg = await loader.load(t.scenarioDir, t.configFile);
    for (const f of [...cfg.globalFiles, ...cfg.logicFiles]) set.add(f);
  }
  if (set.size === 0) {
    const srcDir = join(scenarioDir, "source");
    if (existsSync(srcDir)) for (const f of await readdir(srcDir)) if (f.endsWith(".js")) set.add(join(srcDir, f));
  }
  return [...set];
}

async function readZipMembersIfAny(scenarioDir: string): Promise<string[] | undefined> {
  let entries: string[] = [];
  try { entries = await readdir(scenarioDir); } catch { return undefined; }
  const zip = entries.find((e) => e.endsWith(".zip"));
  if (!zip) return undefined;
  const res = Bun.spawnSync(["unzip", "-Z1", join(scenarioDir, zip)]);
  if (res.exitCode !== 0) return undefined;
  return res.stdout.toString().split("\n").map((l) => l.trim()).filter((l) => l.endsWith(".json")).map((l) => basename(l));
}

function detectCollisions(outPaths: string[], issues: Issue[]): void {
  const seen = new Map<string, number>();
  for (const p of outPaths) seen.set(p, (seen.get(p) ?? 0) + 1);
  for (const [p, n] of seen) if (n > 1) issues.push({ severity: "error", code: "collision", message: `Несколько исходников пишут в один JSON: ${basename(p)}` });
}

function detectOrphans(
  scenarioDir: string,
  existingJsons: { file: string }[],
  plans: { outPath: string }[],
  manifest: PublishManifest,
  issues: Issue[],
): void {
  const targets = new Set(plans.map((p) => basename(p.outPath)));
  for (const j of existingJsons) {
    const b = basename(j.file);
    if (!targets.has(b)) issues.push({ severity: "warning", code: "orphan", message: `JSON ${b} не привязан к исходнику в publish.json (возможно, устарел)`, file: b });
  }
}

async function maybeBuildArchive(
  scenarioDir: string,
  manifest: PublishManifest,
  plans: { mf: ManifestFile; tpl?: ScenarioTemplateJson; outPath: string }[],
  folderName: string,
): Promise<void> {
  if (!manifest.archive) return;
  const zipName = typeof manifest.archive === "string" ? manifest.archive : `${folderName}.zip`;
  const includeAll = manifest.archive === true && !plans.some((p) => p.mf.archive);
  const entries = plans
    .filter((p) => includeAll || p.mf.archive)
    .map((p) => ({ name: basename(p.outPath), data: serializeScenarioJson(p.tpl!) }));
  if (entries.length === 0) return;
  const bytes = createZip(entries);
  await writeFile(join(scenarioDir, zipName), bytes);
}

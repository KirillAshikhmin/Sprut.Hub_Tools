import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { detectScenarioType } from "./detectType.js";
import { parseInfo } from "./parseInfo.js";
import type { ManifestFile, PublishManifest, ScenarioTemplateJson } from "./types.js";

export async function loadManifest(scenarioDir: string): Promise<PublishManifest | null> {
  const p = join(scenarioDir, "publish.json");
  if (!existsSync(p)) return null;
  return JSON.parse(await readFile(p, "utf-8")) as PublishManifest;
}

export interface DeriveInput {
  scenarioDir: string;
  sourceFiles: string[]; // абсолютные пути
  existingJsons: { file: string; tpl: ScenarioTemplateJson }[];
  folderName: string;
  zipMembers?: string[]; // базовые имена json внутри существующего zip
}

/** Автовывод манифеста, когда publish.json отсутствует. */
export async function deriveManifest(input: DeriveInput): Promise<PublishManifest> {
  const { scenarioDir, sourceFiles, existingJsons, folderName, zipMembers } = input;
  const files: ManifestFile[] = [];
  const usedGlobals = new Set<string>();

  const logicCandidates: { mf: ManifestFile; matchesFolder: boolean }[] = [];

  for (const abs of sourceFiles) {
    const text = await readFile(abs, "utf-8");
    const type = detectScenarioType(text);
    const rel = "./" + relative(scenarioDir, abs).split("\\").join("/");
    const mf: ManifestFile = { source: rel.replace(/^\.\//, "") };
    mf.type = type;

    if (type === "LOGIC" || type === "TEMPLATE") {
      const info = parseInfo(text).fields;
      const match = existingJsons.find((j) => info.name && j.tpl.name === info.name);
      mf.json = match ? basename(match.file) : `${info.name ?? folderName}.json`;
      const matchesFolder = (info.name ?? "").toLowerCase().includes(folderName.toLowerCase());
      logicCandidates.push({ mf, matchesFolder });
    } else {
      // GLOBAL: лучший по содержимому среди ещё не использованных GLOBAL-JSON.
      let best: { file: string; tpl: ScenarioTemplateJson } | null = null;
      let bestScore = 0;
      for (const j of existingJsons) {
        if (j.tpl.type !== "GLOBAL" || usedGlobals.has(j.file)) continue;
        const s = similarity(text, j.tpl.data);
        if (s > bestScore) { bestScore = s; best = j; }
      }
      if (best && bestScore >= 0.2) {
        usedGlobals.add(best.file);
        mf.json = basename(best.file);
        mf.name = best.tpl.name;
      } else {
        mf.json = `${folderName}.json`;
        mf.name = folderName;
      }
    }

    if (zipMembers && mf.json && zipMembers.includes(mf.json)) mf.archive = true;
    files.push(mf);
  }

  // primary: логический, чьё имя ближе к имени папки; иначе первый логический.
  const primary = logicCandidates.find((c) => c.matchesFolder) ?? logicCandidates[0];
  if (primary) primary.mf.primary = true;

  const manifest: PublishManifest = { files };
  if (zipMembers) {
    // Есть существующий zip — подставим его имя (ищем среди файлов папки в оркестраторе).
    manifest.archive = true;
  }
  return manifest;
}

/** Jaccard-похожесть по множествам идентификаторов исходников. */
export function similarity(a: string, b: string): number {
  const sa = identifiers(a);
  const sb = identifiers(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function identifiers(src: string): Set<string> {
  const out = new Set<string>();
  const re = /[A-Za-z_$][A-Za-z0-9_$]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[0]);
  return out;
}

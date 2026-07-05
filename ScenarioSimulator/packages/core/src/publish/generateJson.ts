import type { InfoMeta, ManifestFile, ScenarioTemplateJson, ScenarioType } from "./types.js";

export interface BuildJsonInput {
  type: ScenarioType;
  source: string; // дословный текст .js -> data
  info: InfoMeta; // распарсенные литеральные поля (пусто для GLOBAL)
  manifestFile: ManifestFile;
  existingJson?: ScenarioTemplateJson | null;
  folderName: string; // fallback для name
}

/** Собирает объект scenarioTemplate по правилам §5 спеки. */
export function buildScenarioJson(input: BuildJsonInput): ScenarioTemplateJson {
  const { type, source, info, manifestFile: mf, existingJson: ex, folderName } = input;
  const isLogic = type === "LOGIC" || type === "TEMPLATE";

  const name = isLogic
    ? info.name ?? mf.name ?? ex?.name ?? folderName
    : mf.name ?? ex?.name ?? folderName;

  const desc = isLogic
    ? info.description ?? mf.desc ?? ex?.desc ?? ""
    : mf.desc ?? ex?.desc ?? "";

  const active = firstDefined(isLogic ? info.active : undefined, mf.active, ex?.active, true) as boolean;
  const sync = firstDefined(isLogic ? info.sync : undefined, mf.sync, ex?.sync, false) as boolean;

  const tpl: ScenarioTemplateJson = { name, desc, active, sync, data: source, type };

  if (isLogic) {
    // onStart по умолчанию true (Global Constraints)
    tpl.onStart = firstDefined(info.onStart, ex?.onStart, true) as boolean;
  }
  // порядок ключей выставит сериализатор
  return orderKeys(tpl);
}

function orderKeys(t: ScenarioTemplateJson): ScenarioTemplateJson {
  const ordered: ScenarioTemplateJson = {
    name: t.name,
    desc: t.desc,
    active: t.active,
  } as ScenarioTemplateJson;
  if (t.onStart !== undefined) ordered.onStart = t.onStart;
  ordered.sync = t.sync;
  ordered.data = t.data;
  ordered.type = t.type;
  return ordered;
}

/** Сериализация с обёрткой и отступом 2. Порядок ключей задан в orderKeys. */
export function serializeScenarioJson(tpl: ScenarioTemplateJson): string {
  return JSON.stringify({ scenarioTemplate: tpl }, null, 2) + "\n";
}

function firstDefined(...vals: unknown[]): unknown {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}

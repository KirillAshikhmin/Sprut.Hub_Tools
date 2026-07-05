import type { Issue } from "./types.js";

export interface LogicVersionInput {
  version?: string;
  primary?: boolean;
}

/**
 * Версия папки: сперва из логических файлов (источник правды), затем manifestVersion.
 *  - 1 логический => его версия;
 *  - >1 с primary => версия primary;
 *  - >1 без primary, версии равны => она; различны => ошибка (уточнить primary);
 *  - логических нет => manifestVersion;
 *  - ничего => null (проверка неприменима).
 */
export function resolveVersion(
  logics: LogicVersionInput[],
  manifestVersion?: string,
): { version: string | null; issues: Issue[] } {
  const withVersion = logics.filter((l) => l.version);
  if (withVersion.length === 1) return { version: withVersion[0]!.version!, issues: [] };
  if (withVersion.length > 1) {
    const primary = withVersion.find((l) => l.primary);
    if (primary) return { version: primary.version!, issues: [] };
    const uniq = [...new Set(withVersion.map((l) => l.version))];
    if (uniq.length === 1) return { version: uniq[0]!, issues: [] };
    return {
      version: null,
      issues: [{
        severity: "error",
        code: "version-ambiguous",
        message: `Несколько логических файлов с разными версиями (${uniq.join(", ")}). Пометьте один как "primary": true в publish.json или задайте "version".`,
      }],
    };
  }
  if (manifestVersion) return { version: manifestVersion, issues: [] };
  return { version: null, issues: [] };
}

/** Ищет в README раздел «История изменений» и запись с текущей версией. */
export function checkChangelog(readmeText: string, version: string): Issue[] {
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Заголовок (# .. ######), содержащий номер версии, не окружённый цифрой/точкой.
  const re = new RegExp(`^#{1,6}[^\\n]*(?<![0-9.])${esc}(?![0-9.])`, "m");
  if (re.test(readmeText)) return [];
  return [{
    severity: "error",
    code: "changelog-missing",
    message: `В README нет записи об изменениях для версии ${version} (раздел «История изменений»).`,
  }];
}

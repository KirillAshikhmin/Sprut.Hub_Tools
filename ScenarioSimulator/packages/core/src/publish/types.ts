// Общие типы модуля публикации.
export type ScenarioType = "LOGIC" | "GLOBAL" | "TEMPLATE";

export type Severity = "error" | "warning";

/** Одна запись отчёта. Проверки НЕ бросают исключения, а возвращают Issue[]. */
export interface Issue {
  severity: Severity;
  code: string; // "syntax" | "unsupported" | "info-missing" | "info-nonliteral" | "changelog-missing" | "version-ambiguous" | "collision" | "orphan" | "version-drift" | "test-failed" | "manifest" | "source-missing"
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

/** Литеральные поля блока info, которые нас интересуют. */
export interface InfoMeta {
  name?: string;
  description?: string;
  version?: string;
  onStart?: boolean;
  active?: boolean;
  sync?: boolean;
}

export interface ParsedInfo {
  present: boolean; // найден ли верхнеуровневый info = {…}
  fields: InfoMeta; // извлечённые литеральные поля
  nonLiteralFields: string[]; // имена полей, присутствующих, но не-литералов
}

export interface ManifestFile {
  source: string; // путь относительно папки сценария
  json?: string; // имя выходного JSON
  type?: ScenarioType;
  name?: string;
  desc?: string;
  active?: boolean;
  sync?: boolean;
  primary?: boolean; // основной логический файл (для выбора версии)
  archive?: boolean; // включать в zip
}

export interface PublishManifest {
  version?: string; // fallback-версия (только если нет логических файлов)
  archive?: string | boolean; // имя zip или true (=> <Папка>.zip)
  files: ManifestFile[];
}

export interface ScenarioTemplateJson {
  name: string;
  desc: string;
  active: boolean;
  onStart?: boolean; // не задаётся для GLOBAL
  sync: boolean;
  data: string;
  type: ScenarioType;
}

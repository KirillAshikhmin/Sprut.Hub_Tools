# Команда `publish` — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одной командой готовить сценарий Sprut.Hub к публикации: генерировать `.json` из `source/*.js`, прогонять все проверки (синтаксис, неподдерживаемые конструкции, `info`, changelog, коллизии/сироты, дрейф версии, тесты) и собирать zip-архив.

**Architecture:** Чистая логика — в `packages/core/src/publish/*` (тестируемые модули), поверх уже существующих `Validator`, `ConfigLoader`, `Runner`. Тонкая CLI-команда `publish` в `packages/cli` + корневой bash-алиас `./publish`. Модель конвейера — «собрать все ошибки, потом решать»: сначала все проверки без записи, запись файлов только при нуле ошибок.

**Tech Stack:** TypeScript (ESM, NodeNext, импорт с расширением `.js`), Bun 1.3, citty (CLI), acorn/acorn-walk (AST), zod (схемы) — всё уже в зависимостях. Тесты — `bun:test`. Zip — собственный STORE-writer на CRC32 (node:zlib не нужен).

## Global Constraints

- **Ограничения Nashorn ES5+ относятся к ПРОВЕРЯЕМЫМ сценариям, а НЕ к коду инструмента.** Сам инструмент — обычный TS/Bun, любые возможности разрешены.
- **Никаких новых npm-зависимостей.** Только `acorn`, `acorn-walk`, `zod` (уже в `core`) и встроенные Bun/Node API.
- **Импорты — с расширением `.js`** (как во всём `core`), напр. `import { parseInfo } from "./parseInfo.js"`.
- **Комментарии и текст сообщений — на русском.** Идентификаторы — на английском.
- **Порядок ключей в генерируемом JSON:** `name, desc, active, onStart(только LOGIC/TEMPLATE), sync, data, type`. Отступ — 2 пробела. Обёртка — `{ "scenarioTemplate": {…} }`.
- **`onStart` по умолчанию `true`** для LOGIC/TEMPLATE; **у GLOBAL поле `onStart` не эмитится.**
- **Дисциплина коммитов:** работа в отдельной ветке/worktree. Каждый коммит добавляет **только свои файлы явными путями** (`git add <path> …`). **Никогда** `git add -A`/`git add .` — в рабочем дереве есть несвязанные правки пользователя, их трогать нельзя.
- **Все проверки собирают `Issue[]`**, не бросают исключения по месту. Тип `Issue` — из §Task 1.

---

## Структура файлов

Создаётся:
- `ScenarioSimulator/packages/core/src/publish/types.ts` — общие типы.
- `.../publish/detectType.ts` — определение типа сценария по AST.
- `.../publish/parseInfo.ts` — статическое извлечение полей `info`.
- `.../publish/generateJson.ts` — сборка и сериализация `scenarioTemplate`.
- `.../publish/changelog.ts` — версия папки + проверка README.
- `.../publish/zip.ts` — минимальный ZIP-writer (STORE).
- `.../publish/manifest.ts` — загрузка/автовывод `publish.json`.
- `.../publish/publish.ts` — оркестратор `runPublish`.
- `.../publish/index.ts` — реэкспорт.
- `ScenarioSimulator/packages/cli/src/commands/publish.ts` — CLI-команда + отчёт.
- `ScenarioSimulator/schemas/publish.schema.json` — JSON-схема манифеста.
- `./publish` — корневой bash-алиас.
- `ScenarioSimulator/packages/core/test/publish/*.test.ts` — тесты.
- `ScenarioSimulator/packages/core/test/publish/fixtures/**` — фикстуры.

Изменяется:
- `ScenarioSimulator/packages/core/src/index.ts` — добавить `export * from "./publish/index.js"`.
- `ScenarioSimulator/packages/cli/bin/scenario-sim.ts` — зарегистрировать `publish`.
- `CLAUDE.md` — политика JSON + описание команды.

---

## Предварительно: ветка

- [ ] **Создать рабочую ветку** (не коммитить в `main` поверх грязного дерева пользователя):

```bash
cd /Users/asihminkirill/GitHub/Sprut.Hub_Tools
git checkout -b feature/publish-command
```

Expected: `Switched to a new branch 'feature/publish-command'`. Незакоммиченные правки пользователя остаются в дереве — их НЕ коммитим.

---

### Task 1: Типы + определение типа сценария

**Files:**
- Create: `ScenarioSimulator/packages/core/src/publish/types.ts`
- Create: `ScenarioSimulator/packages/core/src/publish/detectType.ts`
- Test: `ScenarioSimulator/packages/core/test/publish/detectType.test.ts`

**Interfaces:**
- Produces: `ScenarioType = "LOGIC"|"GLOBAL"|"TEMPLATE"`; `Severity`, `Issue`, `InfoMeta`, `ParsedInfo`, `ManifestFile`, `PublishManifest`, `ScenarioTemplateJson` (типы); `detectScenarioType(source: string): ScenarioType`.

- [ ] **Step 1: Написать типы** — `publish/types.ts`:

```ts
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
```

- [ ] **Step 2: Написать падающий тест** — `test/publish/detectType.test.ts`:

```ts
import { test, expect, describe } from "bun:test";
import { detectScenarioType } from "../../src/publish/detectType.js";

const LOGIC = `info = { name: "X", onStart: true }\nfunction trigger(s, v) {}`;
const LOGIC_COMPUTE = `var info = { name: "X" }\nfunction compute(s, v) { return v }`;
const GLOBAL = `const VERSION = "7.0"\nfunction helper(a) { return a }`;
const TEMPLATE = `function update(context, variables) { return 1 }`;

describe("detectScenarioType", () => {
  test("info + trigger => LOGIC", () => {
    expect(detectScenarioType(LOGIC)).toBe("LOGIC");
  });
  test("info + compute => LOGIC", () => {
    expect(detectScenarioType(LOGIC_COMPUTE)).toBe("LOGIC");
  });
  test("без info и trigger => GLOBAL", () => {
    expect(detectScenarioType(GLOBAL)).toBe("GLOBAL");
  });
  test("update без info => TEMPLATE", () => {
    expect(detectScenarioType(TEMPLATE)).toBe("TEMPLATE");
  });
  test("синтаксически битый, но с info=/function trigger => LOGIC (regex-fallback)", () => {
    expect(detectScenarioType(`info = {\nfunction trigger(s){`)).toBe("LOGIC");
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/detectType.test.ts`
Expected: FAIL — `Cannot find module ".../detectType.js"`.

- [ ] **Step 4: Реализация** — `publish/detectType.ts`:

```ts
import { parse } from "acorn";
import type { ScenarioType } from "./types.js";

/**
 * Тип сценария определяется по СОДЕРЖИМОМУ исходника, а не по config.json
 * (там globals/logic описывают загрузку для симулятора, а не тип публикации).
 *  - верхнеуровневый `info = {…}` + function trigger/compute => LOGIC
 *  - function update(...) без info => TEMPLATE
 *  - иначе => GLOBAL
 * Если acorn не смог распарсить (это отдельно поймает Validator), падаем на regex.
 */
export function detectScenarioType(source: string): ScenarioType {
  try {
    const ast = parse(source, {
      ecmaVersion: 2020,
      sourceType: "script",
      allowReturnOutsideFunction: true,
    }) as unknown as { body: AnyNode[] };
    let hasInfo = false;
    let hasTrigger = false;
    let hasCompute = false;
    let hasUpdate = false;
    for (const node of ast.body) {
      if (isInfoAssignment(node)) hasInfo = true;
      if (node.type === "FunctionDeclaration") {
        const name = node.id?.name;
        if (name === "trigger") hasTrigger = true;
        if (name === "compute") hasCompute = true;
        if (name === "update") hasUpdate = true;
      }
    }
    if (hasInfo && (hasTrigger || hasCompute)) return "LOGIC";
    if (hasUpdate && !hasInfo) return "TEMPLATE";
    return "GLOBAL";
  } catch {
    return detectByRegex(source);
  }
}

type AnyNode = {
  type: string;
  id?: { name?: string };
  expression?: { type: string; operator?: string; left?: { type: string; name?: string }; right?: { type: string } };
  declarations?: { id?: { name?: string }; init?: { type?: string } }[];
};

function isInfoAssignment(node: AnyNode): boolean {
  if (
    node.type === "ExpressionStatement" &&
    node.expression?.type === "AssignmentExpression" &&
    node.expression.operator === "=" &&
    node.expression.left?.type === "Identifier" &&
    node.expression.left.name === "info" &&
    node.expression.right?.type === "ObjectExpression"
  ) {
    return true;
  }
  if (node.type === "VariableDeclaration") {
    return (node.declarations ?? []).some((d) => d.id?.name === "info" && d.init?.type === "ObjectExpression");
  }
  return false;
}

function detectByRegex(source: string): ScenarioType {
  const hasInfo = /(^|\n)\s*(var\s+)?info\s*=/.test(source);
  const hasTrigger = /function\s+(trigger|compute)\s*\(/.test(source);
  const hasUpdate = /function\s+update\s*\(/.test(source);
  if (hasInfo && hasTrigger) return "LOGIC";
  if (hasUpdate && !hasInfo) return "TEMPLATE";
  return "GLOBAL";
}
```

- [ ] **Step 5: Запустить тест — зелёный**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/detectType.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 6: Commit**

```bash
git add ScenarioSimulator/packages/core/src/publish/types.ts ScenarioSimulator/packages/core/src/publish/detectType.ts ScenarioSimulator/packages/core/test/publish/detectType.test.ts
git commit -m "feat(publish): типы модуля и определение типа сценария"
```

---

### Task 2: Извлечение метаданных `info`

**Files:**
- Create: `ScenarioSimulator/packages/core/src/publish/parseInfo.ts`
- Test: `ScenarioSimulator/packages/core/test/publish/parseInfo.test.ts`

**Interfaces:**
- Consumes: `InfoMeta`, `ParsedInfo` (Task 1).
- Produces: `parseInfo(source: string): ParsedInfo`.

- [ ] **Step 1: Падающий тест** — `test/publish/parseInfo.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Запуск — падает**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/parseInfo.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация** — `publish/parseInfo.ts`:

```ts
import { parse } from "acorn";
import type { InfoMeta, ParsedInfo } from "./types.js";

const WANTED: (keyof InfoMeta)[] = ["name", "description", "version", "onStart", "active", "sync"];
const STRING_FIELDS = new Set(["name", "description", "version"]);
const BOOL_FIELDS = new Set(["onStart", "active", "sync"]);

/**
 * Статически извлекает интересующие поля info без исполнения кода сценария.
 * На практике name/description/version — строковые литералы, onStart/active/sync —
 * булевы. Остальное (options/values и т.п.) игнорируется. Поля, присутствующие,
 * но заданные не-литералом, попадают в nonLiteralFields.
 */
export function parseInfo(source: string): ParsedInfo {
  const empty: ParsedInfo = { present: false, fields: {}, nonLiteralFields: [] };
  let ast: { body: AnyNode[] };
  try {
    ast = parse(source, { ecmaVersion: 2020, sourceType: "script", allowReturnOutsideFunction: true }) as unknown as { body: AnyNode[] };
  } catch {
    return empty;
  }

  const obj = findInfoObject(ast.body);
  if (!obj) return empty;

  const fields: InfoMeta = {};
  const nonLiteralFields: string[] = [];
  for (const prop of obj.properties ?? []) {
    if (prop.type !== "Property" || prop.key?.type !== "Identifier") continue;
    const key = prop.key.name as keyof InfoMeta;
    if (!WANTED.includes(key)) continue;
    const lit = literalValue(prop.value);
    if (lit === NOT_LITERAL) {
      nonLiteralFields.push(key);
      continue;
    }
    if (STRING_FIELDS.has(key) && typeof lit === "string") (fields as Record<string, unknown>)[key] = lit;
    else if (BOOL_FIELDS.has(key) && typeof lit === "boolean") (fields as Record<string, unknown>)[key] = lit;
    else nonLiteralFields.push(key);
  }
  return { present: true, fields, nonLiteralFields };
}

type AnyNode = {
  type: string;
  operator?: string;
  left?: { type: string; name?: string };
  right?: AnyNode;
  expression?: AnyNode;
  declarations?: { id?: { name?: string }; init?: AnyNode }[];
  properties?: { type: string; key?: { type: string; name?: string }; value?: AnyNode }[];
  value?: unknown;
  quasis?: { value?: { cooked?: string } }[];
  expressions?: unknown[];
};

const NOT_LITERAL = Symbol("not-literal");

function findInfoObject(body: AnyNode[]): AnyNode | null {
  for (const node of body) {
    if (
      node.type === "ExpressionStatement" &&
      node.expression?.type === "AssignmentExpression" &&
      node.expression.left?.type === "Identifier" &&
      node.expression.left.name === "info" &&
      node.expression.right?.type === "ObjectExpression"
    ) {
      return node.expression.right;
    }
    if (node.type === "VariableDeclaration") {
      for (const d of node.declarations ?? []) {
        if (d.id?.name === "info" && d.init?.type === "ObjectExpression") return d.init;
      }
    }
  }
  return null;
}

function literalValue(node: AnyNode | undefined): string | boolean | typeof NOT_LITERAL {
  if (!node) return NOT_LITERAL;
  if (node.type === "Literal" && (typeof node.value === "string" || typeof node.value === "boolean")) {
    return node.value;
  }
  // Шаблонная строка без подстановок: `текст`
  if (node.type === "TemplateLiteral" && (node.expressions?.length ?? 0) === 0 && node.quasis?.length === 1) {
    return node.quasis[0]?.value?.cooked ?? NOT_LITERAL;
  }
  return NOT_LITERAL;
}
```

- [ ] **Step 4: Запуск — зелёный**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/parseInfo.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add ScenarioSimulator/packages/core/src/publish/parseInfo.ts ScenarioSimulator/packages/core/test/publish/parseInfo.test.ts
git commit -m "feat(publish): статическое извлечение полей info"
```

---

### Task 3: Сборка и сериализация JSON

**Files:**
- Create: `ScenarioSimulator/packages/core/src/publish/generateJson.ts`
- Test: `ScenarioSimulator/packages/core/test/publish/generateJson.test.ts`

**Interfaces:**
- Consumes: `ScenarioType`, `InfoMeta`, `ManifestFile`, `ScenarioTemplateJson` (Task 1).
- Produces:
  - `buildScenarioJson(input: BuildJsonInput): ScenarioTemplateJson`
  - `serializeScenarioJson(tpl: ScenarioTemplateJson): string`
  - `BuildJsonInput = { type, source, info, manifestFile, existingJson?, folderName }`

- [ ] **Step 1: Падающий тест** — `test/publish/generateJson.test.ts`:

```ts
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
```

- [ ] **Step 2: Запуск — падает**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/generateJson.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация** — `publish/generateJson.ts`:

```ts
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
```

- [ ] **Step 4: Запуск — зелёный**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/generateJson.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Commit**

```bash
git add ScenarioSimulator/packages/core/src/publish/generateJson.ts ScenarioSimulator/packages/core/test/publish/generateJson.test.ts
git commit -m "feat(publish): сборка и сериализация scenarioTemplate JSON"
```

---

### Task 4: Версия папки и проверка changelog

**Files:**
- Create: `ScenarioSimulator/packages/core/src/publish/changelog.ts`
- Test: `ScenarioSimulator/packages/core/test/publish/changelog.test.ts`

**Interfaces:**
- Consumes: `Issue` (Task 1).
- Produces:
  - `resolveVersion(logics: LogicVersionInput[], manifestVersion?: string): { version: string | null; issues: Issue[] }`
  - `checkChangelog(readmeText: string, version: string): Issue[]`
  - `LogicVersionInput = { version?: string; primary?: boolean }`

- [ ] **Step 1: Падающий тест** — `test/publish/changelog.test.ts`:

```ts
import { test, expect, describe } from "bun:test";
import { resolveVersion, checkChangelog } from "../../src/publish/changelog.js";

describe("resolveVersion", () => {
  test("один логический => его версия", () => {
    expect(resolveVersion([{ version: "2.0" }]).version).toBe("2.0");
  });
  test("несколько с primary => версия primary", () => {
    expect(resolveVersion([{ version: "1.1" }, { version: "7.0", primary: true }]).version).toBe("7.0");
  });
  test("несколько без primary, версии равны => она же", () => {
    expect(resolveVersion([{ version: "3.0" }, { version: "3.0" }]).version).toBe("3.0");
  });
  test("несколько разных без primary => null + ошибка", () => {
    const r = resolveVersion([{ version: "1.1" }, { version: "7.0" }]);
    expect(r.version).toBeNull();
    expect(r.issues[0]?.code).toBe("version-ambiguous");
  });
  test("нет логических => manifestVersion", () => {
    expect(resolveVersion([], "5.0").version).toBe("5.0");
  });
  test("нет ничего => null без ошибки", () => {
    const r = resolveVersion([]);
    expect(r.version).toBeNull();
    expect(r.issues).toEqual([]);
  });
});

describe("checkChangelog", () => {
  const readmeA = `# S\n## 🕘 История изменений\n### Версия 3.0 (текущая)\n- a\n### Версия 3.1\n- b`;
  const readmeB = `# История изменений:\n## 6.0\n- x\n## 5.1\n- y`;
  test("формат '### Версия 3.1' находится", () => {
    expect(checkChangelog(readmeA, "3.1")).toEqual([]);
  });
  test("формат '## 6.0' находится", () => {
    expect(checkChangelog(readmeB, "6.0")).toEqual([]);
  });
  test("версия 7.0 отсутствует => ошибка", () => {
    const issues = checkChangelog(readmeB, "7.0");
    expect(issues[0]?.severity).toBe("error");
    expect(issues[0]?.code).toBe("changelog-missing");
  });
  test("не путает 3.1 с 3.10", () => {
    expect(checkChangelog(`## 3.10\n- z`, "3.1")[0]?.code).toBe("changelog-missing");
  });
});
```

- [ ] **Step 2: Запуск — падает**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/changelog.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация** — `publish/changelog.ts`:

```ts
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
```

- [ ] **Step 4: Запуск — зелёный**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/changelog.test.ts`
Expected: PASS (10 тестов).

- [ ] **Step 5: Commit**

```bash
git add ScenarioSimulator/packages/core/src/publish/changelog.ts ScenarioSimulator/packages/core/test/publish/changelog.test.ts
git commit -m "feat(publish): выбор версии папки и проверка changelog"
```

---

### Task 5: ZIP-writer (STORE)

**Files:**
- Create: `ScenarioSimulator/packages/core/src/publish/zip.ts`
- Test: `ScenarioSimulator/packages/core/test/publish/zip.test.ts`

**Interfaces:**
- Produces: `createZip(entries: ZipEntry[]): Uint8Array`; `ZipEntry = { name: string; data: Uint8Array | string }`.

- [ ] **Step 1: Падающий тест** — `test/publish/zip.test.ts`. ВАЖНО: старый macOS `unzip` 6.00 показывает UTF-8-имена как mojibake (баг ОТОБРАЖЕНИЯ, не архива), поэтому реальную распаковку проверяем на ASCII-именах, а корректность кириллических имён и флага UTF-8 — побайтово, без внешнего инструмента:

```ts
import { test, expect, describe } from "bun:test";
import { createZip } from "../../src/publish/zip.js";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("createZip", () => {
  test("реальная распаковка системным unzip (ASCII-имена) даёт исходное содержимое", () => {
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
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint16(6, true) & 0x0800).toBe(0x0800);
    const nameLen = dv.getUint16(26, true);
    const nameBytes = zip.subarray(30, 30 + nameLen);
    expect(new TextDecoder().decode(nameBytes)).toBe(name);
    expect(new TextDecoder("latin1").decode(zip)).not.toContain("__MACOSX");
  });

  test("EOCD присутствует, число записей верное", () => {
    const zip = createZip([{ name: "a.json", data: "1" }, { name: "b.json", data: "2" }]);
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOff = zip.byteLength - 22;
    expect(dv.getUint32(eocdOff, true)).toBe(0x06054b50);
    expect(dv.getUint16(eocdOff + 10, true)).toBe(2);
  });
});
```

- [ ] **Step 2: Запуск — падает**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/zip.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация** — `publish/zip.ts` (метод STORE, флаг UTF-8):

```ts
export interface ZipEntry {
  name: string;
  data: Uint8Array | string;
}

// Таблица CRC32.
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Минимальный ZIP без сжатия (метод STORE). Имена — UTF-8 (флаг бита 11),
 * чтобы кириллица читалась корректно и без мусора __MACOSX.
 */
export function createZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const data = typeof e.data === "string" ? enc.encode(e.data) : e.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // сигнатура
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // flags: UTF-8 имена
    lv.setUint16(8, 0, true); // method: STORE
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // comp size
    lv.setUint32(22, data.length, true); // uncomp size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra len
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // flags
    cv.setUint16(10, 0, true); // method
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // offset local header
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of [...chunks, ...central, eocd]) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
```

- [ ] **Step 4: Запуск — зелёный**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/zip.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add ScenarioSimulator/packages/core/src/publish/zip.ts ScenarioSimulator/packages/core/test/publish/zip.test.ts
git commit -m "feat(publish): минимальный ZIP-writer (STORE, UTF-8)"
```

---

### Task 6: Манифест — загрузка и автовывод

**Files:**
- Create: `ScenarioSimulator/packages/core/src/publish/manifest.ts`
- Create (фикстуры): `ScenarioSimulator/packages/core/test/publish/fixtures/manual/publish.json`
- Test: `ScenarioSimulator/packages/core/test/publish/manifest.test.ts`

**Interfaces:**
- Consumes: `detectScenarioType` (T1), `parseInfo` (T2), `ScenarioTemplateJson`, `PublishManifest`, `ManifestFile` (T1).
- Produces:
  - `loadManifest(scenarioDir: string): Promise<PublishManifest | null>`
  - `deriveManifest(input: DeriveInput): Promise<PublishManifest>`
  - `similarity(a: string, b: string): number`
  - `DeriveInput = { scenarioDir; sourceFiles: string[]; existingJsons: { file: string; tpl: ScenarioTemplateJson }[]; folderName: string; zipMembers?: string[] }`

- [ ] **Step 1: Фикстура** — `test/publish/fixtures/manual/publish.json`:

```json
{
  "archive": "manual.zip",
  "files": [
    { "source": "source/Логический.js", "primary": true },
    { "source": "source/Глоб.js", "json": "Пакет. Глоб.json", "name": "Пакет. Глоб", "archive": true }
  ]
}
```

- [ ] **Step 2: Падающий тест** — `test/publish/manifest.test.ts`:

```ts
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
```

- [ ] **Step 3: Создать фикстуры для deriveManifest** — файлы:

`test/publish/fixtures/derive/source/Логический.js`:
```js
info = { name: "Основной", version: "7.0" }
function trigger(source, value) { helperX() }
```

`test/publish/fixtures/derive/source/Глоб.js`:
```js
function helperX() { return 1 }
```

(JSON-файлы `derive/*.json` в тесте не читаются — они передаются как `existingJsons` напрямую; создавать их не нужно.)

- [ ] **Step 4: Запуск — падает**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/manifest.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 5: Реализация** — `publish/manifest.ts`:

```ts
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
```

- [ ] **Step 6: Запуск — зелёный**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/manifest.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 7: Commit**

```bash
git add ScenarioSimulator/packages/core/src/publish/manifest.ts ScenarioSimulator/packages/core/test/publish/manifest.test.ts ScenarioSimulator/packages/core/test/publish/fixtures
git commit -m "feat(publish): загрузка и автовывод манифеста publish.json"
```

---

### Task 7: Оркестратор `runPublish` + реэкспорт

**Files:**
- Create: `ScenarioSimulator/packages/core/src/publish/publish.ts`
- Create: `ScenarioSimulator/packages/core/src/publish/index.ts`
- Modify: `ScenarioSimulator/packages/core/src/index.ts` (добавить реэкспорт)
- Create (фикстура): `ScenarioSimulator/packages/core/test/publish/fixtures/ok/**` (мини-сценарий)
- Test: `ScenarioSimulator/packages/core/test/publish/publish.test.ts`

**Interfaces:**
- Consumes: всё из T1–T6, `Validator` (`@scenario-simulator/core` → `runtime/Validator.js`), `ConfigLoader`, `Runner`.
- Produces:
  - `runPublish(opts: RunPublishOptions): Promise<PublishResult>`
  - `RunPublishOptions = { scenarioDir; rootDir; write: boolean; runTests: boolean; allowMissingChangelog: boolean; initOnly?: boolean }`
  - `PublishResult = { ok; issues: Issue[]; generated: GeneratedFile[]; wroteManifest; manifestPath; testSummary?; wrote: boolean }`
  - `GeneratedFile = { path: string; bytes: number; changed: boolean }`

- [ ] **Step 1: Фикстура-сценарий** (валидный, тесты пропускаем через `runTests:false`):

`test/publish/fixtures/ok/source/Ok.js`:
```js
info = {
  name: "Ок сценарий",
  description: "тест",
  version: "1.0",
  onStart: true,
  sourceServices: [HS.Switch],
  sourceCharacteristics: [HC.On]
}
function trigger(source, value, variables, options, context) {
  var on = source.getValue()
}
```

`test/publish/fixtures/ok/README.md`:
```markdown
# Ок сценарий

## История изменений
### Версия 1.0
- первый релиз
```

`test/publish/fixtures/ok/.tests/config.json`:
```json
{
  "name": "Ok",
  "scenario": { "globals": [], "logic": ["../source/Ok.js"] },
  "tests": ["*.test.js"]
}
```

- [ ] **Step 2: Падающий тест** — `test/publish/publish.test.ts`:

```ts
import { test, expect, describe } from "bun:test";
import { runPublish } from "../../src/publish/publish.js";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";

const FIX = join(import.meta.dir, "fixtures");
const OK = join(FIX, "ok");

function cleanup(dir: string) {
  for (const f of ["Ok.json", "publish.json"]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
}

describe("runPublish (dry-run, без тестов)", () => {
  test("валидный сценарий: ok=true, ничего не пишется", async () => {
    cleanup(OK);
    const r = await runPublish({ scenarioDir: OK, rootDir: FIX, write: false, runTests: false, allowMissingChangelog: false });
    expect(r.ok).toBe(true);
    expect(r.wrote).toBe(false);
    expect(existsSync(join(OK, "Ok.json"))).toBe(false);
    const gen = r.generated.find((g) => g.path.endsWith("Ok.json"));
    expect(gen).toBeTruthy();
  });

  test("write=true пишет JSON и publish.json", async () => {
    cleanup(OK);
    const r = await runPublish({ scenarioDir: OK, rootDir: FIX, write: true, runTests: false, allowMissingChangelog: false });
    expect(r.ok).toBe(true);
    expect(r.wrote).toBe(true);
    expect(existsSync(join(OK, "Ok.json"))).toBe(true);
    expect(existsSync(join(OK, "publish.json"))).toBe(true);
    cleanup(OK);
  });
});

describe("runPublish собирает ошибки, не прерываясь", () => {
  test("неподдерживаемая конструкция + отсутствие changelog => >=2 ошибки, ничего не пишется", async () => {
    const BAD = join(FIX, "bad");
    const r = await runPublish({ scenarioDir: BAD, rootDir: FIX, write: true, runTests: false, allowMissingChangelog: false });
    expect(r.ok).toBe(false);
    expect(r.wrote).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain("unsupported");
    expect(codes).toContain("changelog-missing");
    expect(existsSync(join(BAD, "Bad.json"))).toBe(false);
  });
});
```

- [ ] **Step 3: Фикстура «плохого» сценария**:

`test/publish/fixtures/bad/source/Bad.js`:
```js
info = { name: "Плохой", description: "d", version: "9.9" }
class Nope {}
function trigger(source, value) { var x = source.getValue() }
```

`test/publish/fixtures/bad/README.md`:
```markdown
# Плохой
## История изменений
### Версия 1.0
- старое
```

`test/publish/fixtures/bad/.tests/config.json`:
```json
{ "name": "Bad", "scenario": { "globals": [], "logic": ["../source/Bad.js"] }, "tests": ["*.test.js"] }
```

- [ ] **Step 4: Запуск — падает**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/publish.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 5: Реализация** — `publish/publish.ts`:

```ts
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
    if (manifestDerived && opts.write) {
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      wroteManifest = true;
    }
    return { ok: true, issues, generated, wroteManifest, manifestPath, wrote: false };
  }

  const validator = new Validator({ mode: "es5+" });
  const logicInputs: LogicVersionInput[] = [];
  type Plan = { mf: ManifestFile; abs: string; text: string; type: ScenarioType; tpl?: ScenarioTemplateJson; outPath: string };
  const plans: Plan[] = [];

  // --- Фаза 1: проверки по каждому файлу ---
  for (const mf of manifest.files) {
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
    if (type === "LOGIC" || type === "TEMPLATE") {
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
    if ((type === "LOGIC" || type === "TEMPLATE") && ex && ex.data.trim() !== text.trim()) {
      const oldV = parseInfo(ex.data).fields.version;
      if (oldV && oldV === parsed.fields.version) {
        issues.push({ severity: "warning", code: "version-drift", message: `Код ${mf.source} изменился, но версия осталась ${oldV} — поднимите версию и добавьте запись в changelog`, file: mf.source });
      }
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
```

> Примечание для реализующего: `type` в цикле имеет тип `ScenarioType` (значение `mf.type ?? detectScenarioType(text)`), поэтому передаётся в `buildScenarioJson` напрямую. `serializeScenarioJson` используется и в `generated`, и в `maybeBuildArchive`, чтобы текст JSON везде считался одинаково.

- [ ] **Step 6: Реэкспорт** — `publish/index.ts`:

```ts
export * from "./types.js";
export { detectScenarioType } from "./detectType.js";
export { parseInfo } from "./parseInfo.js";
export { buildScenarioJson, serializeScenarioJson } from "./generateJson.js";
export { resolveVersion, checkChangelog } from "./changelog.js";
export { createZip } from "./zip.js";
export { loadManifest, deriveManifest, similarity } from "./manifest.js";
export { runPublish } from "./publish.js";
export type { RunPublishOptions, PublishResult, GeneratedFile } from "./publish.js";
```

- [ ] **Step 7: Добавить в core index** — `packages/core/src/index.ts`, в конец:

```ts
export * from "./publish/index.js";
```

- [ ] **Step 8: Запуск — зелёный**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/publish.test.ts`
Expected: PASS (3 теста). Убедиться, что после теста `fixtures/ok/Ok.json` и `publish.json` удалены (cleanup в тесте).

- [ ] **Step 9: Прогнать ВСЕ тесты модуля**

Run: `cd ScenarioSimulator && bun test packages/core/test/publish/`
Expected: PASS (все файлы, ~30 тестов).

- [ ] **Step 10: Commit**

```bash
git add ScenarioSimulator/packages/core/src/publish/publish.ts ScenarioSimulator/packages/core/src/publish/index.ts ScenarioSimulator/packages/core/src/index.ts ScenarioSimulator/packages/core/test/publish/publish.test.ts ScenarioSimulator/packages/core/test/publish/fixtures/ok ScenarioSimulator/packages/core/test/publish/fixtures/bad
git commit -m "feat(publish): оркестратор runPublish (сбор всех ошибок, запись при нуле ошибок)"
```

---

### Task 8: CLI-команда `publish` + отчёт

**Files:**
- Create: `ScenarioSimulator/packages/cli/src/commands/publish.ts`
- Modify: `ScenarioSimulator/packages/cli/bin/scenario-sim.ts`

**Interfaces:**
- Consumes: `runPublish`, `PublishResult`, `Issue` (`@scenario-simulator/core`); `resolveRootDir` (`../default-root.js`); `picocolors`.
- Produces: `publishCommand` (citty), регистрация в `subCommands`.

- [ ] **Step 1: Реализация команды** — `packages/cli/src/commands/publish.ts`:

```ts
import { defineCommand } from "citty";
import { resolve } from "node:path";
import pc from "picocolors";
import { runPublish, type Issue, type PublishResult } from "@scenario-simulator/core";
import { resolveRootDir } from "../default-root.js";

export const publishCommand = defineCommand({
  meta: { name: "publish", description: "Подготовить сценарий к публикации: сгенерировать JSON, прогнать все проверки, собрать архив" },
  args: {
    scenario: { type: "positional", required: true, description: "Папка сценария (имя или путь)" },
    root: { type: "string", description: "Корень репозитория" },
    check: { type: "boolean", description: "Только проверки + diff, без записи", default: false },
    "dry-run": { type: "boolean", description: "Синоним --check", default: false },
    init: { type: "boolean", description: "Только (пере)создать publish.json", default: false },
    "no-tests": { type: "boolean", description: "Пропустить прогон тестов", default: false },
    "allow-missing-changelog": { type: "boolean", description: "Отсутствие changelog => предупреждение", default: false },
  },
  async run({ args }) {
    const rootDir = resolveRootDir(args.root);
    const scenarioDir = resolve(rootDir, String(args.scenario));
    const write = !(args.check || args["dry-run"]);

    const result = await runPublish({
      scenarioDir,
      rootDir,
      write,
      runTests: !args["no-tests"],
      allowMissingChangelog: Boolean(args["allow-missing-changelog"]),
      initOnly: Boolean(args.init),
    });

    process.stdout.write(formatReport(result, write));
    process.exitCode = result.ok ? 0 : 1;
  },
});

function formatReport(r: PublishResult, write: boolean): string {
  const lines: string[] = [];
  const errors = r.issues.filter((i) => i.severity === "error");
  const warnings = r.issues.filter((i) => i.severity === "warning");

  if (errors.length) {
    lines.push(pc.red(pc.bold(`\n✗ Ошибки (${errors.length}):`)));
    for (const it of errors) lines.push("  " + pc.red("●") + " " + fmtIssue(it));
  }
  if (warnings.length) {
    lines.push(pc.yellow(pc.bold(`\n⚠ Предупреждения (${warnings.length}):`)));
    for (const it of warnings) lines.push("  " + pc.yellow("●") + " " + fmtIssue(it));
  }

  if (r.testSummary) {
    const t = r.testSummary;
    const s = `${t.passed}/${t.total} прошло` + (t.failed ? pc.red(`, ${t.failed} упало`) : "");
    lines.push(`\nТесты: ${s}`);
  }

  lines.push("\nБудет сгенерировано:");
  for (const g of r.generated) {
    const mark = g.changed ? pc.cyan("~") : pc.dim("=");
    lines.push(`  ${mark} ${rel(g.path)} (${g.bytes} б)`);
  }

  if (r.ok) {
    if (write && r.wrote) {
      lines.push(pc.green(pc.bold("\n✓ Всё ок — файлы записаны.")));
      if (r.wroteManifest) lines.push(pc.green(`  создан ${rel(r.manifestPath)}`));
    } else {
      lines.push(pc.green(pc.bold("\n✓ Всё ок (проверка без записи).")));
    }
  } else {
    lines.push(pc.red(pc.bold("\n✗ Есть ошибки — ничего не записано. Исправьте и повторите.")));
  }
  return lines.join("\n") + "\n";
}

function fmtIssue(it: Issue): string {
  const loc = it.file ? pc.dim(`${it.file}${it.line ? `:${it.line}` : ""}  `) : "";
  return `${loc}[${it.code}] ${it.message}`;
}

function rel(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(p.lastIndexOf("/", i - 1) + 1) : p;
}
```

- [ ] **Step 2: Зарегистрировать команду** — `packages/cli/bin/scenario-sim.ts`:

Добавить импорт после строки с `serveCommand`:
```ts
import { publishCommand } from "../src/commands/publish.js";
```
И в `subCommands` добавить строку после `serve: serveCommand,`:
```ts
    publish: publishCommand,
```

- [ ] **Step 3: Smoke-тест на валидном сценарии (пишущий режим отключаем через --check)**

Run: `cd ScenarioSimulator && bun run cli publish VirtualThermostat --root .. --check`
Expected: раздел «Тесты: 95/95 прошло», «✓ Всё ок (проверка без записи).», код возврата 0. Файл `VirtualThermostat/VirtualThermostat.json` НЕ изменён (проверить `git status`).

- [ ] **Step 4: Smoke-тест на CircadianLight (ловим отсутствие changelog 7.0)**

Run: `cd ScenarioSimulator && bun run cli publish CircadianLight --root .. --check`
Expected: среди ошибок есть `[changelog-missing] … версии 7.0 …`; «✗ Есть ошибки — ничего не записано»; код возврата 1.

- [ ] **Step 5: Commit**

```bash
git add ScenarioSimulator/packages/cli/src/commands/publish.ts ScenarioSimulator/packages/cli/bin/scenario-sim.ts
git commit -m "feat(publish): CLI-команда publish с единым отчётом об ошибках"
```

---

### Task 9: JSON-схема манифеста + корневой алиас `./publish`

**Files:**
- Create: `ScenarioSimulator/schemas/publish.schema.json`
- Create: `./publish` (корень репозитория)

- [ ] **Step 1: Схема** — `ScenarioSimulator/schemas/publish.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Sprut.Hub publish manifest",
  "type": "object",
  "properties": {
    "$schema": { "type": "string" },
    "version": { "type": "string", "description": "Fallback-версия для changelog (только если нет логических файлов)" },
    "archive": {
      "description": "Имя zip-файла или true (=> <Папка>.zip)",
      "oneOf": [{ "type": "string" }, { "type": "boolean" }]
    },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "source": { "type": "string", "description": "Путь к .js относительно папки сценария" },
          "json": { "type": "string", "description": "Имя выходного JSON (по умолчанию <Папка>.json)" },
          "type": { "enum": ["LOGIC", "GLOBAL", "TEMPLATE"] },
          "name": { "type": "string" },
          "desc": { "type": "string" },
          "active": { "type": "boolean" },
          "sync": { "type": "boolean" },
          "primary": { "type": "boolean", "description": "Основной логический файл (для выбора версии changelog)" },
          "archive": { "type": "boolean", "description": "Включать этот JSON в архив" }
        },
        "required": ["source"],
        "additionalProperties": false
      }
    }
  },
  "required": ["files"],
  "additionalProperties": false
}
```

- [ ] **Step 2: Корневой алиас** — `./publish`:

```bash
#!/usr/bin/env bash
# Алиас для запуска команды публикации из корня репозитория:
#   ./publish <Сценарий> [--check] [--init] [--no-tests] [--allow-missing-changelog]
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bun "$DIR/ScenarioSimulator/packages/cli/bin/scenario-sim.ts" publish "$@" --root "$DIR"
```

- [ ] **Step 3: Сделать исполняемым и проверить из корня**

```bash
cd /Users/asihminkirill/GitHub/Sprut.Hub_Tools
chmod +x ./publish
./publish VirtualThermostat --check
```
Expected: тот же отчёт, что в Task 8 Step 3 (95/95, «✓ Всё ок»), код 0 — но запущено из корня без `cd ScenarioSimulator`.

- [ ] **Step 4: Commit**

```bash
git add ScenarioSimulator/schemas/publish.schema.json publish
git commit -m "feat(publish): JSON-схема манифеста и корневой алиас ./publish"
```

---

### Task 10: Обновить `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Заменить запрет на правку JSON.** Найти в разделе «## Что нельзя редактировать или генерировать» пункт:

```markdown
- **`.json`-файлы сценариев в папках сценариев** (например, `VirtualThermostat/VirtualThermostat.json` и т.п.) — это экспорты из UI Sprut.Hub. Пользователь обновляет их сам. Не создавать и не править.
```

Заменить на:

```markdown
- **`.json`-файлы сценариев в папках сценариев генерируются из `source/*.js` командой `./publish`** (см. раздел «Публикация сценария»). Вручную их НЕ редактировать — правки затрутся при следующей генерации. Источник правды — `source/*.js` + `publish.json`.
```

- [ ] **Step 2: Добавить раздел про публикацию.** В конец `CLAUDE.md` дописать:

```markdown
## Публикация сценария (`./publish`)

Команда готовит сценарий к публикации из его исходников:

```bash
./publish <ИмяПапкиСценария>                 # полный прогон: проверки -> генерация JSON -> тесты -> архив
./publish <Имя> --check                       # только проверки + diff, без записи
./publish <Имя> --init                        # только (пере)создать publish.json
./publish <Имя> --no-tests                    # пропустить тесты
./publish <Имя> --allow-missing-changelog     # отсутствие записи в changelog -> предупреждение
```

Модель: сначала выполняются ВСЕ проверки (синтаксис и неподдерживаемые в Nashorn конструкции, метаданные `info`, наличие записи в README «История изменений» для текущей версии, коллизии/сироты JSON, дрейф версии, тесты симулятора). Если есть хотя бы одна ошибка — печатается весь список, на диск ничего не пишется. Если ошибок нет — генерируются `.json`, при отсутствии — `publish.json`, и собирается zip-архив.

### Манифест `publish.json`

Лежит в корне папки сценария. Описывает соответствие `source/*.js` → выходной JSON и метаданные глобальных сценариев (у них нет блока `info`). Если файла нет — создаётся автоматически при первом запуске (проверьте результат). Полная схема — `ScenarioSimulator/schemas/publish.schema.json`. Ключевые поля: `files[].source` (обязательно), `files[].json`, `files[].name` (для GLOBAL), `files[].primary` (какой логический файл даёт версию для changelog), `files[].archive` и верхнеуровневый `archive` (имя zip или `true`).

Версия для проверки changelog берётся из `info.version` логического файла (при нескольких — из помеченного `primary`), а `publish.json`→`version` используется как запасной вариант для чисто глобальных пакетов.
```

- [ ] **Step 3: Проверка**

Run: `grep -n "./publish" CLAUDE.md && grep -c "Не создавать и не править" CLAUDE.md`
Expected: строки с `./publish` найдены; счётчик старой формулировки = `0`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: политика JSON-экспортов и раздел про команду ./publish"
```

---

### Task 11: Прогон по всем сценариям в режиме `--check` (rollout)

Цель — не молча перегенерировать всё, а получить карту состояния: где чего не хватает (changelog, метаданные), где чистый прогон.

**Files:** нет (только запуск и отчёт пользователю).

- [ ] **Step 1: Полный прогон юнит-тестов симулятора**

Run: `cd ScenarioSimulator && bun test packages/core`
Expected: все тесты зелёные (включая новый `test/publish/`).

- [ ] **Step 2: Проверить каждый сценарий в --check и собрать сводку**

```bash
cd /Users/asihminkirill/GitHub/Sprut.Hub_Tools
for d in */; do
  [ -d "$d/source" ] || continue
  name="${d%/}"
  echo "=== $name ==="
  ./publish "$name" --check --no-tests 2>&1 | tail -3
done
```
Expected: для каждого сценария — короткий вердикт. Ожидаемо: `CircadianLight` падает на changelog 7.0; часть глобальных пакетов может потребовать ручной правки автосгенерированного `publish.json` (имена global). Составить список того, что требует внимания, и показать пользователю — НЕ править сценарии молча.

- [ ] **Step 3: Показать пользователю сводку и спросить**, какие сценарии реально перегенерировать/закоммитить (генерация JSON и `publish.json` — отдельное решение по каждому, т.к. меняет опубликованные артефакты).

---

## Self-Review

**1. Покрытие спеки:**
- §2 архитектура (core/publish + CLI + алиас) → Tasks 1–9. ✓
- §3 манифест + автоген → Task 6, схема Task 9. ✓
- §4 определение типа → Task 1. ✓
- §5 генерация JSON (поля, onStart деф. true, GLOBAL без onStart, порядок ключей) → Task 3. ✓
- §6 версия/changelog (logic→manifest fallback, primary, форматы) → Task 4. ✓
- §7 конвейер «собрать все ошибки → решить» + флаги → Task 7 (runPublish), Task 8 (флаги CLI). ✓
- §8 архив (STORE zip, archive:true подмножество) → Task 5 + `maybeBuildArchive` в Task 7. ✓
- §9 обработка ошибок (Issue[], запись только при 0 ошибок, --check без записи) → Task 7/8. ✓
- §10 тесты публикатора → Tasks 1–7 (bun:test). ✓
- §11 вне рамок (денилист рантайм-API, линт info., .cmd) → НЕ реализуется (осознанно). ✓
- §12 deliverables (включая CLAUDE.md) → Task 10; rollout → Task 11. ✓

**2. Заглушки:** код приведён полностью в каждом шаге; «TODO» нет. В Task 7 есть примечание убрать `as any` — это единственное место с приведением типа, оно помечено.

**3. Согласованность типов:** `Issue`, `InfoMeta`, `ParsedInfo`, `ScenarioTemplateJson`, `ManifestFile`, `PublishManifest` определены в Task 1 и используются под теми же именами далее. `runPublish`/`PublishResult`/`GeneratedFile` из Task 7 потребляются в Task 8. `resolveRootDir`, `ConfigLoader`, `Runner`, `Validator` — существующие API (сигнатуры сверены с кодом: `Runner.run({scenarios, rootDir}) → {summary:{total,passed,failed,…}}`, `Validator.validate(src) → {valid, issues:[{line,column,nodeType,message}]}`).

**4. Риск-заметки для исполнителя:**
- Regex в `checkChangelog` использует lookbehind `(?<!…)` — поддерживается в Bun/V8. Если бы среда его не знала — заменить на проверку соседнего символа вручную.
- `Runner.run` может писать в свою шину событий; в `runPublish` репортеры не подключаются (нам нужен только `summary`) — это нормально.
- Тесты `zip`/`publish` вызывают системный `unzip`/`bun` — на CI это есть на macOS/Linux.

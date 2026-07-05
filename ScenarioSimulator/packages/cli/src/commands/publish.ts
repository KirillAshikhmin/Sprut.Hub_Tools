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

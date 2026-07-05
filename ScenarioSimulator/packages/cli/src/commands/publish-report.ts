import pc from "picocolors";
import type { Issue, PublishResult } from "@scenario-simulator/core";

/** Единый текстовый отчёт по результату публикации (используется CLI и интерактивом). */
export function formatReport(r: PublishResult, write: boolean): string {
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
    if (r.wroteManifest) lines.push(pc.green(`  создан ${rel(r.manifestPath)}`));
    if (write && r.wrote) lines.push(pc.green(pc.bold("\n✓ Всё ок — файлы записаны.")));
    else lines.push(pc.green(pc.bold("\n✓ Всё ок (проверка без записи).")));
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

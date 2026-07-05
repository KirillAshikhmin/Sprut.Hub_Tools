import { createInterface, type Interface } from "node:readline";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { runPublish } from "@scenario-simulator/core";
import { formatReport } from "./publish-report.js";

interface Opts {
  write: boolean;
  runTests: boolean;
  allowMissingChangelog: boolean;
  initOnly: boolean;
}

/**
 * Читатель строк с очередью — надёжен и для TTY (пользователь вводит по одной
 * строке), и для пакетного stdin (строки приходят разом): события `line`
 * складываются в очередь, `ask()` берёт из неё. На EOF возвращает null.
 */
class LineReader {
  private queue: string[] = [];
  private waiting: Array<(line: string | null) => void> = [];
  private closed = false;
  private rl: Interface;

  constructor() {
    this.rl = createInterface({ input: process.stdin });
    this.rl.on("line", (l) => {
      const w = this.waiting.shift();
      if (w) w(l);
      else this.queue.push(l);
    });
    this.rl.on("close", () => {
      this.closed = true;
      for (const w of this.waiting.splice(0)) w(null);
    });
  }

  ask(prompt: string): Promise<string | null> {
    process.stdout.write(prompt);
    const q = this.queue.shift();
    if (q !== undefined) return Promise.resolve(q);
    if (this.closed) return Promise.resolve(null);
    return new Promise((res) => this.waiting.push(res));
  }

  close(): void {
    this.rl.close();
  }
}

/**
 * Интерактивный режим: выбор сценария из списка, выбор параметров, прогон и
 * вывод результата — всё в одном окне. Запускается, когда команда `publish`
 * вызвана без имени сценария (или с флагом --interactive/-i).
 */
export async function runInteractive(rootDir: string): Promise<number> {
  const scenarios = await listScenarios(rootDir);
  if (scenarios.length === 0) {
    process.stdout.write(pc.yellow("Сценарии с папкой `source/` не найдены.\n"));
    return 1;
  }

  const io = new LineReader();
  try {
    process.stdout.write(pc.bold("\n=== Публикация сценария Sprut.Hub ===\n"));
    while (true) {
      const scenario = await pickScenario(io, scenarios);
      if (!scenario) break;
      const opts = await pickOptions(io);

      process.stdout.write(pc.dim(`\n▶ ${scenario} ${describeOpts(opts)}\n`));
      const result = await runPublish({ scenarioDir: join(rootDir, scenario), rootDir, ...opts });
      process.stdout.write(formatReport(result, opts.write));

      const again = ((await io.ask(pc.bold("\nЕщё один сценарий? [y/N]: "))) ?? "").trim().toLowerCase();
      if (again !== "y" && again !== "д") break;
    }
  } finally {
    io.close();
  }
  return 0;
}

async function listScenarios(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "ScenarioSimulator") continue;
    if (existsSync(join(rootDir, e.name, "source"))) out.push(e.name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

async function pickScenario(io: LineReader, scenarios: string[]): Promise<string | null> {
  process.stdout.write("\n");
  scenarios.forEach((s, i) => process.stdout.write(`  ${pc.cyan(String(i + 1).padStart(2))}  ${s}\n`));
  while (true) {
    const raw = await io.ask(pc.bold("\nНомер или часть имени (Enter — выход): "));
    if (raw === null) return null;
    const ans = raw.trim();
    if (!ans) return null;
    const num = Number(ans);
    if (Number.isInteger(num) && num >= 1 && num <= scenarios.length) return scenarios[num - 1]!;
    const matches = scenarios.filter((s) => s.toLowerCase().includes(ans.toLowerCase()));
    if (matches.length === 1) return matches[0]!;
    if (matches.length === 0) process.stdout.write(pc.yellow("  Не найдено, попробуйте снова.\n"));
    else process.stdout.write(pc.yellow(`  Уточните — совпадений ${matches.length}: ${matches.join(", ")}\n`));
  }
}

async function pickOptions(io: LineReader): Promise<Opts> {
  const mode =
    ((await io.ask("\nРежим: [1] полный (запись)  [2] только проверка  [3] только publish.json  (по умолч. 2): ")) ?? "")
      .trim() || "2";

  if (mode === "3") {
    return { write: true, runTests: false, allowMissingChangelog: false, initOnly: true };
  }
  const write = mode === "1";

  const testsAns = ((await io.ask("Прогонять тесты? [Y/n]: ")) ?? "").trim().toLowerCase();
  const runTests = !(testsAns === "n" || testsAns === "н");

  const clAns = ((await io.ask("Нет записи в changelog → [1] ошибка  [2] предупреждение  (по умолч. 1): ")) ?? "").trim();
  const allowMissingChangelog = clAns === "2";

  return { write, runTests, allowMissingChangelog, initOnly: false };
}

function describeOpts(o: Opts): string {
  if (o.initOnly) return pc.dim("(только publish.json)");
  const parts = [o.write ? "запись" : "проверка"];
  if (!o.runTests) parts.push("без тестов");
  if (o.allowMissingChangelog) parts.push("changelog=warn");
  return pc.dim(`(${parts.join(", ")})`);
}

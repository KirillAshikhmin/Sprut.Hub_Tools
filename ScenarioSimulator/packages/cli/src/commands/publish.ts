import { defineCommand } from "citty";
import { resolve } from "node:path";
import { runPublish } from "@scenario-simulator/core";
import { resolveRootDir } from "../default-root.js";
import { formatReport } from "./publish-report.js";
import { runInteractive } from "./publish-interactive.js";

export const publishCommand = defineCommand({
  meta: { name: "publish", description: "Подготовить сценарий к публикации: сгенерировать JSON, прогнать все проверки, собрать архив" },
  args: {
    scenario: { type: "positional", required: false, description: "Папка сценария (имя или путь). Без него — интерактивный выбор" },
    root: { type: "string", description: "Корень репозитория" },
    check: { type: "boolean", description: "Только проверки + diff, без записи", default: false },
    "dry-run": { type: "boolean", description: "Синоним --check", default: false },
    init: { type: "boolean", description: "Только создать publish.json (если отсутствует)", default: false },
    tests: { type: "boolean", description: "Прогонять тесты (--no-tests чтобы пропустить)", default: true },
    "allow-missing-changelog": { type: "boolean", description: "Отсутствие changelog => предупреждение", default: false },
    interactive: { type: "boolean", alias: "i", description: "Интерактивный режим (по умолчанию, если сценарий не указан)", default: false },
  },
  async run({ args }) {
    const rootDir = resolveRootDir(args.root);

    // Без имени сценария (или с --interactive) — интерактивный выбор.
    if (args.interactive || !args.scenario) {
      if (!args.interactive && !process.stdin.isTTY) {
        process.stderr.write(
          "Укажите сценарий: publish <Сценарий> [--check|--init|--no-tests|--allow-missing-changelog]\n" +
            "Или запустите без аргументов в терминале — будет интерактивный выбор.\n",
        );
        process.exitCode = 2;
        return;
      }
      process.exitCode = await runInteractive(rootDir);
      return;
    }

    const scenarioDir = resolve(rootDir, String(args.scenario));
    const write = !(args.check || args["dry-run"]);

    const result = await runPublish({
      scenarioDir,
      rootDir,
      write,
      runTests: args.tests !== false,
      allowMissingChangelog: Boolean(args["allow-missing-changelog"]),
      initOnly: Boolean(args.init),
    });

    process.stdout.write(formatReport(result, write));
    process.exitCode = result.ok ? 0 : 1;
  },
});

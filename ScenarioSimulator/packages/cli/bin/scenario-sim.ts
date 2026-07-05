#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { runCommand } from "../src/commands/run.js";
import { listCommand } from "../src/commands/list.js";
import { initCommand } from "../src/commands/init.js";
import { validateCommand } from "../src/commands/validate.js";
import { watchCommand } from "../src/commands/watch.js";
import { migrateCommand } from "../src/commands/migrate.js";
import { serveCommand } from "../src/commands/serve.js";
import { publishCommand } from "../src/commands/publish.js";

const main = defineCommand({
  meta: {
    name: "scenario-sim",
    version: "0.1.0",
    description: "Sprut.Hub scenario simulator and test runner",
  },
  subCommands: {
    run: runCommand,
    list: listCommand,
    init: initCommand,
    validate: validateCommand,
    watch: watchCommand,
    migrate: migrateCommand,
    serve: serveCommand,
    publish: publishCommand,
  },
});

runMain(main);

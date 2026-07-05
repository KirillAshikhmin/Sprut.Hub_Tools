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

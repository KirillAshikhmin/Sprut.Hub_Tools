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

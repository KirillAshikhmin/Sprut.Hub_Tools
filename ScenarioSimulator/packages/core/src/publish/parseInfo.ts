import { parse } from "acorn";
import type { InfoMeta, ParsedInfo } from "./types.js";

const WANTED: (keyof InfoMeta)[] = ["name", "description", "version", "onStart", "active", "sync"];
const STRING_FIELDS = new Set(["name", "description", "version"]);
const BOOL_FIELDS = new Set(["onStart", "active", "sync"]);

/**
 * Статически извлекает интересующие поля info без исполнения кода сценария.
 * Поддерживает прямые литералы (name: "T") и ссылки вида IDENT.prop, где IDENT —
 * верхнеуровневый объект-литерал (частый DRY-паттерн: описание выносят в
 * переменную и переиспользуют в info и options). Поля, значение которых не
 * удалось свести к литералу, попадают в nonLiteralFields.
 */
export function parseInfo(source: string): ParsedInfo {
  const empty: ParsedInfo = { present: false, fields: {}, nonLiteralFields: [] };
  let ast: { body: AnyNode[] };
  try {
    ast = parse(source, { ecmaVersion: 2020, sourceType: "script", allowReturnOutsideFunction: true }) as unknown as { body: AnyNode[] };
  } catch {
    return empty;
  }

  const objects = collectTopLevelObjects(ast.body);
  const obj = findInfoObject(ast.body);
  if (!obj) return empty;

  const fields: InfoMeta = {};
  const nonLiteralFields: string[] = [];
  for (const prop of obj.properties ?? []) {
    if (prop.type !== "Property" || prop.key?.type !== "Identifier") continue;
    const key = prop.key.name as keyof InfoMeta;
    if (!WANTED.includes(key)) continue;
    const lit = resolveValue(prop.value, objects);
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
  name?: string;
  computed?: boolean;
  left?: { type: string; name?: string };
  right?: AnyNode;
  object?: AnyNode;
  property?: AnyNode;
  expression?: AnyNode;
  declarations?: { id?: { name?: string }; init?: AnyNode }[];
  properties?: { type: string; key?: { type: string; name?: string }; value?: AnyNode }[];
  value?: unknown;
  quasis?: { value?: { cooked?: string } }[];
  expressions?: unknown[];
};

const NOT_LITERAL = Symbol("not-literal");

function collectTopLevelObjects(body: AnyNode[]): Map<string, AnyNode> {
  const map = new Map<string, AnyNode>();
  for (const node of body) {
    if (node.type !== "VariableDeclaration") continue;
    for (const d of node.declarations ?? []) {
      if (d.id?.name && d.init?.type === "ObjectExpression") map.set(d.id.name, d.init);
    }
  }
  return map;
}

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

/** Значение узла как литерал: прямой литерал, no-sub шаблон, или IDENT.prop на верхнеуровневый объект. */
function resolveValue(node: AnyNode | undefined, objects: Map<string, AnyNode>): string | boolean | typeof NOT_LITERAL {
  const direct = literalValue(node);
  if (direct !== NOT_LITERAL) return direct;
  if (
    node?.type === "MemberExpression" &&
    node.computed === false &&
    node.object?.type === "Identifier" &&
    node.object.name &&
    node.property?.type === "Identifier" &&
    node.property.name
  ) {
    const objExpr = objects.get(node.object.name);
    if (objExpr) {
      for (const p of objExpr.properties ?? []) {
        if (p.type === "Property" && p.key?.type === "Identifier" && p.key.name === node.property.name) {
          return literalValue(p.value);
        }
      }
    }
  }
  return NOT_LITERAL;
}

function literalValue(node: AnyNode | undefined): string | boolean | typeof NOT_LITERAL {
  if (!node) return NOT_LITERAL;
  if (node.type === "Literal" && (typeof node.value === "string" || typeof node.value === "boolean")) {
    return node.value;
  }
  if (node.type === "TemplateLiteral" && (node.expressions?.length ?? 0) === 0 && node.quasis?.length === 1) {
    return node.quasis[0]?.value?.cooked ?? NOT_LITERAL;
  }
  return NOT_LITERAL;
}

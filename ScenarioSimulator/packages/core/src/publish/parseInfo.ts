import { parse } from "acorn";
import type { InfoMeta, ParsedInfo } from "./types.js";

const WANTED: (keyof InfoMeta)[] = ["name", "description", "version", "onStart", "active", "sync"];
const STRING_FIELDS = new Set(["name", "description", "version"]);
const BOOL_FIELDS = new Set(["onStart", "active", "sync"]);

/**
 * Статически извлекает интересующие поля info без исполнения кода сценария.
 * Умеет читать значение «по коду»:
 *  - прямые литералы и шаблоны без подстановок;
 *  - конкатенацию строк ("текст" + f()) — берёт литеральные части, вызовы пропускает;
 *  - IDENT.prop — значение поля верхнеуровневого объекта-литерала;
 *  - bare IDENT на объект {ru,…} — берётся поле ru; или на строковую константу.
 * DRY-паттерн (описание/имя вынесены в переменную и переиспользуются в info и
 * options) поэтому читается. Что свести к строке не удалось — в nonLiteralFields.
 */
export function parseInfo(source: string): ParsedInfo {
  const empty: ParsedInfo = { present: false, fields: {}, nonLiteralFields: [] };
  let ast: { body: AnyNode[] };
  try {
    ast = parse(source, { ecmaVersion: 2020, sourceType: "script", allowReturnOutsideFunction: true }) as unknown as { body: AnyNode[] };
  } catch {
    return empty;
  }

  const scope = collectTopLevel(ast.body);
  const obj = findInfoObject(ast.body);
  if (!obj) return empty;

  const fields: InfoMeta = {};
  const nonLiteralFields: string[] = [];
  for (const prop of obj.properties ?? []) {
    if (prop.type !== "Property" || prop.key?.type !== "Identifier") continue;
    const key = prop.key.name as keyof InfoMeta;
    if (!WANTED.includes(key)) continue;
    const lit = resolveValue(prop.value, scope);
    if (lit === NOT_LITERAL) { nonLiteralFields.push(key); continue; }
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
  left?: AnyNode;
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

type Scope = { objects: Map<string, AnyNode>; strings: Map<string, string> };

/** Верхнеуровневые объявления: объекты-литералы и строковые константы. */
function collectTopLevel(body: AnyNode[]): Scope {
  const objects = new Map<string, AnyNode>();
  const strings = new Map<string, string>();
  for (const node of body) {
    if (node.type !== "VariableDeclaration") continue;
    for (const d of node.declarations ?? []) {
      const name = d.id?.name;
      if (!name || !d.init) continue;
      if (d.init.type === "ObjectExpression") objects.set(name, d.init);
      else {
        const v = literalValue(d.init);
        if (typeof v === "string") strings.set(name, v);
      }
    }
  }
  return { objects, strings };
}

function findInfoObject(body: AnyNode[]): AnyNode | null {
  for (const node of body) {
    if (
      node.type === "ExpressionStatement" &&
      node.expression?.type === "AssignmentExpression" &&
      node.expression.left?.type === "Identifier" &&
      node.expression.left.name === "info" &&
      node.expression.right?.type === "ObjectExpression"
    ) return node.expression.right;
    if (node.type === "VariableDeclaration") {
      for (const d of node.declarations ?? []) {
        if (d.id?.name === "info" && d.init?.type === "ObjectExpression") return d.init;
      }
    }
  }
  return null;
}

/** Значение узла как литерал строки/буля, читая «по коду» (см. описание parseInfo). */
function resolveValue(node: AnyNode | undefined, scope: Scope, depth = 0): string | boolean | typeof NOT_LITERAL {
  if (depth > 20) return NOT_LITERAL;
  if (!node) return NOT_LITERAL;

  const direct = literalValue(node);
  if (direct !== NOT_LITERAL) return direct;

  // Конкатенация строк: склеиваем строковые части, нестроковые (вызовы и т.п.) пропускаем.
  if (node.type === "BinaryExpression" && node.operator === "+") {
    let out = "";
    let anyString = false;
    for (const part of flattenPlus(node)) {
      const v = resolveValue(part, scope, depth + 1);
      if (typeof v === "string") { out += v; anyString = true; }
    }
    return anyString ? out : NOT_LITERAL;
  }

  // IDENT.prop — поле верхнеуровневого объекта.
  if (
    node.type === "MemberExpression" && node.computed === false &&
    node.object?.type === "Identifier" && node.object.name &&
    node.property?.type === "Identifier" && node.property.name
  ) {
    const objExpr = scope.objects.get(node.object.name);
    const propVal = objExpr && findProp(objExpr, node.property.name);
    if (propVal) return resolveValue(propVal, scope, depth + 1);
    return NOT_LITERAL;
  }

  // bare IDENT: объект {ru,…} -> поле ru; либо строковая константа.
  if (node.type === "Identifier" && node.name) {
    const objExpr = scope.objects.get(node.name);
    if (objExpr) {
      const ru = findProp(objExpr, "ru");
      if (ru) return resolveValue(ru, scope, depth + 1);
    }
    const s = scope.strings.get(node.name);
    if (s !== undefined) return s;
  }

  return NOT_LITERAL;
}

function flattenPlus(node: AnyNode): AnyNode[] {
  if (node.type === "BinaryExpression" && node.operator === "+") {
    return [...flattenPlus(node.left as AnyNode), ...flattenPlus(node.right as AnyNode)];
  }
  return [node];
}

function findProp(objExpr: AnyNode, name: string): AnyNode | undefined {
  for (const p of objExpr.properties ?? []) {
    if (p.type === "Property" && p.key?.type === "Identifier" && p.key.name === name) return p.value;
  }
  return undefined;
}

function literalValue(node: AnyNode | undefined): string | boolean | typeof NOT_LITERAL {
  if (!node) return NOT_LITERAL;
  if (node.type === "Literal" && (typeof node.value === "string" || typeof node.value === "boolean")) return node.value;
  if (node.type === "TemplateLiteral" && (node.expressions?.length ?? 0) === 0 && node.quasis?.length === 1) {
    return node.quasis[0]?.value?.cooked ?? NOT_LITERAL;
  }
  return NOT_LITERAL;
}

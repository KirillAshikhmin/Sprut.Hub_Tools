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

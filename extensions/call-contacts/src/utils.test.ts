import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeNumber, parseDialableNumber, prettyLabel } from "./utils";

describe("normalizeNumber", () => {
  it("keeps + and digits", () => {
    expect(normalizeNumber("+7 (916) 123-45-67")).toBe("+79161234567");
  });
  it("keeps leading 8 without plus", () => {
    expect(normalizeNumber("8 916 555-35-35")).toBe("89165553535");
  });
  it("strips a plus that is not leading", () => {
    expect(normalizeNumber("7+916")).toBe("7916");
  });
  it("handles whitespace around the number", () => {
    expect(normalizeNumber("  +49 30 901820  ")).toBe("+4930901820");
  });
  it("returns empty string for letters-only input", () => {
    expect(normalizeNumber("nope")).toBe("");
  });
});

describe("prettyLabel", () => {
  it("unwraps AppleScript-style labels", () => {
    expect(prettyLabel("_$!<Mobile>!$_")).toBe("Mobile");
  });
  it("capitalizes localized labels", () => {
    expect(prettyLabel("сотовый")).toBe("Сотовый");
    expect(prettyLabel("mobile")).toBe("Mobile");
  });
  it("keeps custom labels", () => {
    expect(prettyLabel("Дача")).toBe("Дача");
  });
  it("returns empty string for empty input", () => {
    expect(prettyLabel("")).toBe("");
  });
});

describe("matchesQuery", () => {
  const fields = { name: "Иван Петров", org: "Acme", label: "Сотовый", number: "+79161234567" };

  it("matches a name substring (not only prefixes)", () => {
    expect(matchesQuery(fields, "петро", "")).toBe(true);
  });
  it("matches the middle of a phone number", () => {
    expect(matchesQuery(fields, "123-45", "12345")).toBe(true);
  });
  it("matches organization and label", () => {
    expect(matchesQuery(fields, "acme", "")).toBe(true);
    expect(matchesQuery(fields, "сотовый", "")).toBe(true);
  });
  it("rejects unrelated queries", () => {
    expect(matchesQuery(fields, "сидоров", "")).toBe(false);
    expect(matchesQuery(fields, "999", "999")).toBe(false);
  });
});

describe("parseDialableNumber", () => {
  it("accepts digits with separators", () => {
    expect(parseDialableNumber("+7 (916) 123-45-67")).toBe("+79161234567");
    expect(parseDialableNumber("8916.555.35.35")).toBe("89165553535");
  });
  it("requires at least 3 digits", () => {
    expect(parseDialableNumber("12")).toBeNull();
    expect(parseDialableNumber("+1")).toBeNull();
    expect(parseDialableNumber("112")).toBe("112");
  });
  it("rejects text queries", () => {
    expect(parseDialableNumber("Иван")).toBeNull();
    expect(parseDialableNumber("iv 123")).toBeNull();
    expect(parseDialableNumber("")).toBeNull();
  });
});

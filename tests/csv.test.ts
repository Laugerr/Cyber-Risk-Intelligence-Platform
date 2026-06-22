import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "../lib/csv";

describe("toCsv", () => {
  it("emits a header from the first row's keys", () => {
    expect(toCsv([{ a: 1, b: 2 }])).toBe("a,b\n1,2\n");
  });
  it("quotes fields containing commas, quotes or newlines", () => {
    const csv = toCsv([{ name: "a,b", note: 'he said "hi"' }]);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"he said ""hi"""');
  });
  it("returns just a header for empty rows when columns are given", () => {
    expect(toCsv([], ["x", "y"])).toBe("x,y\n");
  });
});

describe("parseCsv", () => {
  it("parses header + rows into objects", () => {
    const rows = parseCsv("name,age\nAlice,30\nBob,25");
    expect(rows).toEqual([{ name: "Alice", age: "30" }, { name: "Bob", age: "25" }]);
  });
  it("returns [] when there is no data row", () => {
    expect(parseCsv("only,header")).toEqual([]);
  });
});

describe("round-trip", () => {
  it("survives commas, quotes and embedded newlines", () => {
    const original = [
      { name: "a,b", note: 'he said "hi"' },
      { name: "x", note: "line1\nline2" },
    ];
    const parsed = parseCsv(toCsv(original));
    expect(parsed).toEqual([
      { name: "a,b", note: 'he said "hi"' },
      { name: "x", note: "line1\nline2" },
    ]);
  });
});

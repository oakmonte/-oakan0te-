import { describe, expect, test } from "bun:test";
import { csvProblem } from "./csv-file-check";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("csvProblem", () => {
  test("accepts a plain CSV", () => {
    expect(csvProblem(bytes("Handle,Title,Price\r\nshirt,Shirt,5000\n"))).toBeNull();
  });
  test("accepts UTF-8 text with a BOM and non-ASCII names", () => {
    expect(csvProblem(bytes("﻿Name,Prix\nCafé,₦5,000\n"))).toBeNull();
  });
  test("rejects a JPEG", () => {
    expect(csvProblem(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]))).toMatch(
      /photo/,
    );
  });
  test("rejects a PNG", () => {
    expect(csvProblem(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toMatch(/photo/);
  });
  test("rejects an .xlsx (zip)", () => {
    expect(csvProblem(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).toMatch(/Excel/);
  });
  test("rejects other binary", () => {
    expect(csvProblem(new Uint8Array([0x01, 0x02, 0x00, 0x41]))).toMatch(/isn't a CSV/);
  });
});

import { describe, it, expect } from "vitest";
import { cosineSimilarity, rankByCosine } from "./cosine";

describe("cosineSimilarity", () => {
  it("returns 1 for identical direction vectors", () => {
    expect(
      cosineSimilarity(new Float32Array([1, 0]), new Float32Array([2, 0])),
    ).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(
      cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1])),
    ).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(
      cosineSimilarity(new Float32Array([1, 0]), new Float32Array([-1, 0])),
    ).toBeCloseTo(-1);
  });

  it("returns 0 when either vector is all zeros (no divide-by-zero)", () => {
    expect(
      cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1])),
    ).toBe(0);
  });
});

describe("rankByCosine", () => {
  const query = new Float32Array([1, 0]);
  const items = [
    { id: "a", vector: new Float32Array([0, 1]) }, // orthogonal (0)
    { id: "b", vector: new Float32Array([1, 0]) }, // identical (1)
    { id: "c", vector: new Float32Array([0.7, 0.7]) }, // ~0.707
  ];

  it("orders items by descending similarity", () => {
    const ranked = rankByCosine(query, items);
    expect(ranked.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("includes the score on each result", () => {
    const ranked = rankByCosine(query, items);
    expect(ranked[0].score).toBeCloseTo(1);
  });

  it("applies topK when provided", () => {
    const ranked = rankByCosine(query, items, 2);
    expect(ranked.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("returns an empty array when there are no items", () => {
    expect(rankByCosine(query, [])).toEqual([]);
  });
});

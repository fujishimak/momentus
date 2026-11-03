/**
 * On-device text embeddings (FR12, FR14). The heavy `transformers.js` model is
 * behind an {@link Embedder} interface so feature code and tests depend only on
 * the contract, not the model. The real model is loaded lazily and cached; CI
 * and unit tests inject a fake embedder via {@link setEmbedder}.
 */

export interface Embedder {
  /** Produce a normalized embedding vector for the given text. */
  embed(text: string): Promise<Float32Array>;
  /** Whether embeddings are available in this environment (WebAssembly ok). */
  isAvailable(): boolean;
}

/** The embedding model id (small, wasm-friendly). */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * Lazy `transformers.js` embedder. Imports the library on first use so the
 * model and wasm runtime are only fetched when embeddings are actually needed
 * (cached by the service worker thereafter, FR14).
 */
class TransformersEmbedder implements Embedder {
  private extractor: unknown;

  isAvailable(): boolean {
    return typeof WebAssembly !== "undefined";
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.extractor) {
      const { pipeline } = await import("@huggingface/transformers");
      this.extractor = await pipeline("feature-extraction", EMBEDDING_MODEL);
    }
    const extractor = this.extractor as (
      input: string,
      opts: { pooling: "mean"; normalize: boolean },
    ) => Promise<{ data: Float32Array }>;
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Float32Array.from(output.data);
  }
}

let instance: Embedder | undefined;

/** Process-wide embedder (lazy transformers.js by default). */
export function getEmbedder(): Embedder {
  if (!instance) {
    instance = new TransformersEmbedder();
  }
  return instance;
}

/** Test seam: inject a fake/deterministic embedder. */
export function setEmbedder(embedder: Embedder): void {
  instance = embedder;
}

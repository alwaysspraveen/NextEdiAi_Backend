import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { ENV } from "./env.js";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export async function getEmbeddings() {
  if (ENV.EMBED_PROVIDER === "hf_inference") {
    const { HuggingFaceInferenceEmbeddings } = await import(
      "@langchain/community/embeddings/hf"
    );
    const modelName =
      ENV.HF_EMBED_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
    const apiKey = ENV.HF_TOKEN;
    if (!apiKey)
      throw new Error("HF_TOKEN is required when EMBED_PROVIDER=hf_inference");
    return new HuggingFaceInferenceEmbeddings({ model: modelName, apiKey });
  }

  const { HuggingFaceTransformersEmbeddings } = await import(
    "@langchain/community/embeddings/hf_transformers"
  );
  const modelName = ENV.HF_EMBED_MODEL || "Xenova/all-MiniLM-L6-v2";
  return new HuggingFaceTransformersEmbeddings({ model: modelName });
}

const faissCache = new Map<string, FaissStore>();

export async function getVectorStore(materialId: string, docs?: Document[]) {
  if (faissCache.has(materialId)) {
    return { kind: "faiss", store: faissCache.get(materialId)! };
  }

  const dir = join("vectorstores", materialId);
  const embeddings = await getEmbeddings();

  let store: FaissStore;
  if (existsSync(dir)) {
    store = await FaissStore.load(dir, embeddings);
  } else {
    if (!docs || docs.length === 0) {
      throw new Error("No docs provided and no FAISS store found.");
    }
    store = await FaissStore.fromDocuments(docs, embeddings);
    await store.save(dir);
  }

  faissCache.set(materialId, store); // cache in memory

  return { kind: "faiss", store };
}

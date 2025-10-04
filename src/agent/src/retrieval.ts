import type { Document } from "@langchain/core/documents";
import { getVectorStore } from "./vectorstore.js";

export type Citation = { page: number | null; snippet: string };

export function docsToCitations(docs: Document[]): Citation[] {
  return docs.map((d) => {
    const raw = (d.metadata as any)?.page;
    const page =
      typeof raw === "number"
        ? raw
        : Number.isFinite(Number(raw))
        ? Number(raw)
        : null;
    return { page, snippet: String(d.pageContent ?? "").slice(0, 140) };
  });
}

export async function getRetrieverForMaterial(materialId: string, k = 8) {
  const { store } = await getVectorStore(materialId); // only 1 arg here is fine
  const predicate = (doc: Document) =>
    String(doc.metadata?.materialId) === String(materialId);
  return store.asRetriever({ k, searchType: "similarity", filter: predicate });
}

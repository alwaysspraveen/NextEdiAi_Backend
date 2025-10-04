// src/ingest.ts
import { loadAndSplit } from "./loaders.js";
import { getVectorStore } from "./vectorstore.js";
import type { MaterialMeta } from "./types.js";

export async function ingestMaterial(meta: MaterialMeta) {
  const { docs, stats } = await loadAndSplit(
    meta.path,
    {
      tenantId: meta.tenantId,
      classId: meta.classId,
      sectionId: meta.sectionId,
      subjectId: meta.subjectId,
      materialId: meta.materialId,
      title: meta.title,
    },
    meta.type
  );

  if (!docs.length) {
    throw new Error("No chunks produced from document (empty content).");
  }

  const { store } = await getVectorStore(meta.materialId, docs); // now valid
  await store.addDocuments(docs);

  return { ok: true, chunks: docs.length, stats };
}

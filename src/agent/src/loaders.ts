// src/loaders.ts
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Document } from "@langchain/core/documents";

export type LoadStats = {
  totalPages: number;
  pagesWithText: number;
  emptyPages: number[];
};

function pageFromMeta(d: Document, i: number) {
  const m: any = d.metadata || {};
  return (
    m?.loc?.pageNumber ??
    m?.page ??
    m?.pdf?.page ??
    (Number.isFinite(+m?.pageNumber) ? +m.pageNumber : i + 1)
  );
}

export async function loadAndSplit(
  filePath: string,
  commonMeta: Record<string, any>,
  fileType: "pdf" | "docx"
): Promise<{ docs: Document[]; stats: LoadStats }> {
  const loader =
    fileType === "pdf"
      ? new PDFLoader(filePath, { splitPages: true })
      : new DocxLoader(filePath);

  const raw = (await loader.load()) as Document[];

  // normalize metadata and count empty pages
  let totalPages = 0;
  const emptyPages: number[] = [];
  // If many empty pages and UNSTRUCTURED_URL is set, try OCR once
  const needOCR = emptyPages.length > 0 && process.env.UNSTRUCTURED_URL;
  if (needOCR && fileType === "pdf") {
    try {
      const { UnstructuredLoader } = await import(
        "@langchain/community/document_loaders/fs/unstructured"
      );
      const u = new UnstructuredLoader(filePath, {
        apiUrl: process.env.UNSTRUCTURED_URL!,
        strategy: "auto",
      });
      const ocrDocs = (await u.load()) as Document[];

      // normalize + re-split
      ocrDocs.forEach((d, i) => {
        const page = pageFromMeta(d, i);
        d.metadata = { ...d.metadata, ...commonMeta, page, ocr: true };
      });

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 900,
        chunkOverlap: 150,
      });
      const split = await splitter.splitDocuments(ocrDocs);

      // Use OCR result if it yields more pagesWithText than the original
      const pagesOCR = new Set(
        split
          .map((d) => Number((d.metadata as any)?.page))
          .filter(Number.isFinite) as number[]
      );
      const pagesRaw = new Set(
        raw
          .filter((d) => (d.pageContent || "").trim().length >= 15)
          .map((d, i) => pageFromMeta(d, i))
      );
      if (pagesOCR.size > (pagesRaw.size || 0)) {
        return {
          docs: split,
          stats: {
            totalPages,
            pagesWithText: pagesOCR.size,
            emptyPages: Array.from(
              { length: totalPages },
              (_, i) => i + 1
            ).filter((p) => !pagesOCR.has(p)),
          },
        };
      }
    } catch (err) {
      // OCR optional: ignore errors and keep original
    }
  }

  raw.forEach((d, i) => {
    const page = pageFromMeta(d, i);
    d.metadata = { ...d.metadata, ...commonMeta, page };
    totalPages = Math.max(totalPages, Number(page) || totalPages);
    const len = (d.pageContent || "").trim().length;
    if (len < 15) emptyPages.push(page);
  });

  // split
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 900,
    chunkOverlap: 150,
  });
  const docs = await splitter.splitDocuments(raw);

  // pages that produced at least one chunk
  const pagesWithText = new Set<number>();
  docs.forEach((d) => {
    const p = Number((d.metadata as any)?.page);
    if (Number.isFinite(p)) pagesWithText.add(p);
  });

  return {
    docs,
    stats: {
      totalPages,
      pagesWithText: pagesWithText.size,
      emptyPages: Array.from(new Set(emptyPages)).sort((a, b) => a - b),
    },
  };
}

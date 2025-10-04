export type MaterialMeta = {
  tenantId: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  materialId: string;  // your DB id
  title?: string;
  type: "pdf" | "docx";
  path: string;
};

export type Citation = {
  page: number | null;   // normalized
  snippet: string;       // normalized
};
export type RawCitation = {
  page?: number | null | undefined;
  snippet?: string | undefined;
};

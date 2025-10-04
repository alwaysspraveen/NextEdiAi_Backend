// src/server.ts
import express from "express";
import multer from "multer";
import path from "path";
import cors from "cors";

import { ENV } from "./env.js";
import { ingestMaterial } from "./ingest.js";
import { getAgentExecutor } from "./agent.js";
import { getRetrieverForMaterial } from "./retrieval.js";
import { QA_PROMPT } from "./prompts.js";

import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";

/* ---------- Multer storage: keep correct file extension ---------- */
const storage = multer.diskStorage({
  destination: path.join(process.cwd(), "uploads"),
  filename: (_req, file, cb) => {
    const origExt = path.extname(file.originalname || "");
    const guessed =
      !origExt &&
      (file.mimetype === "application/pdf"
        ? ".pdf"
        : file.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? ".docx"
        : "");
    const ext = origExt || guessed || "";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({ storage });

/* ---------- Express ---------- */
const app = express();
app.use(cors());
app.use(express.json()); // 👈 ADD THIS LINE

/* ---------- Helper: build chat model (no undefined apiKey) ---------- */
function makeChatModel() {
  if (ENV.CHAT_PROVIDER === "groq") {
    if (!ENV.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is required when CHAT_PROVIDER=groq");
    }
    return new ChatGroq({ model: ENV.CHAT_MODEL, apiKey: ENV.GROQ_API_KEY });
  }
  if (ENV.CHAT_PROVIDER === "openai") {
    if (!ENV.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required when CHAT_PROVIDER=openai");
    }
    return new ChatOpenAI({
      model: ENV.CHAT_MODEL,
      apiKey: ENV.OPENAI_API_KEY,
    });
  }
  // If you truly only want Groq, you can throw here instead:
  throw new Error(
    `Unsupported CHAT_PROVIDER: ${ENV.CHAT_PROVIDER}. Use 'groq' or 'openai'.`
  );
}

/* ---------- Upload -> Ingest ---------- */
app.post("/api/materials/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      throw new Error("No file uploaded (form-data key must be 'file').");

    const mime = req.file.mimetype || "";
    const detectedType =
      mime === "application/pdf"
        ? "pdf"
        : mime ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? "docx"
        : (String(req.body.type) as "pdf" | "docx"); // last resort if mimetype unknown

    const meta = {
      tenantId: String(req.body.tenantId || ""),
      classId: String(req.body.classId || ""),
      sectionId: String(req.body.sectionId || ""),
      subjectId: String(req.body.subjectId || ""),
      teacherId: String(req.body.teacherId || ""),
      title: String(req.body.title || req.file.originalname || "Material"),
      type: detectedType,
      materialId: String(req.body.materialId || ""),
      path: req.file.path,
    };

    if (!meta.materialId) throw new Error("materialId is required.");

    const out = await ingestMaterial(meta);
    res.json({
      ok: true,
      materialId: meta.materialId,
      chunks: out.chunks,
      stats: out.stats,
    });
  } catch (e: any) {
    console.error("UPLOAD/INGEST ERROR:", e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/* ---------- Chat (agent first, simple RAG fallback) ---------- */
app.post("/api/rag/chat", async (req, res) => {
  try {
    const {
      materialId,
      input,
      chat_history = [],
    } = req.body as {
      materialId: string;
      input: string;
      chat_history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!materialId || !input) {
      return res
        .status(400)
        .json({ ok: false, error: "materialId and input are required." });
    }

    // Agent path (tools)
    const agent = await getAgentExecutor();
    if (agent) {
      const result = await agent.invoke({
        input: `Material ID: ${materialId}. User says: ${input}.
                When you call tools, ALWAYS include this materialId.`,
        chat_history,
      });
      if (result?.output) {
        return res.json({ ok: true, output: result.output });
      }
    } 

    // Fallback: simple RAG
    const retriever = await getRetrieverForMaterial(materialId, 8);
    const docs = await retriever.getRelevantDocuments(input);
    const context = docs.map((d) => d.pageContent).join("\n---\n");

    const llm = makeChatModel(); // will throw if misconfigured
    const chain = RunnableSequence.from([
      QA_PROMPT,
      llm,
      new StringOutputParser(),
    ]);
    const text = await chain.invoke({ question: input, context });

    const sources =
      "Sources: " +
      Array.from(new Set(docs.map((d) => `p.${d.metadata?.page ?? "?"}`))).join(
        "; "
      );

    res.json({ ok: true, output: `${text}\n\n${sources}` });
  } catch (e: any) {
    console.error("CHAT ERROR:", e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/* ---------- Health ---------- */
app.get("/", (_req, res) =>
  res.send("CampusFlow Agentic RAG (Groq/OpenAI + HF embeddings) up")
);

app.listen(ENV.PORT, () => console.log("Server on", ENV.PORT));

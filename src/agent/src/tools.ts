import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  getRetrieverForMaterial,
  docsToCitations,
  type Citation,
} from "./retrieval.js";
import { QA_PROMPT, SUMMARIZE_PROMPT, QUIZ_PROMPT } from "./prompts.js";
import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { ENV } from "./env.js";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

const MAX_CONTEXT = 18_000;
const clamp = (s: string) =>
  s.length > MAX_CONTEXT ? s.slice(0, MAX_CONTEXT) : s;

function model() {
  if (ENV.CHAT_PROVIDER === "groq") {
    if (!ENV.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is required when CHAT_PROVIDER=groq");
    }
    return new ChatGroq({
      model: ENV.CHAT_MODEL,
      apiKey: ENV.GROQ_API_KEY, // included only when defined
    });
  }

  // openai
  if (!ENV.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when CHAT_PROVIDER=openai");
  }
  return new ChatOpenAI({
    model: ENV.CHAT_MODEL,
    apiKey: ENV.OPENAI_API_KEY, // included only when defined
  });
}

function normalizeCitations(
  input?: { page?: number | null | undefined; snippet?: string | undefined }[]
): Citation[] {
  if (!input) return [];
  return input.map((c) => ({ page: c.page ?? null, snippet: c.snippet ?? "" }));
}

function sourcesFromCitations(citations: readonly Citation[]) {
  if (!citations.length) return "Sources: none";
  const pages = Array.from(
    new Set(
      citations.map((c) => (typeof c.page === "number" ? `p.${c.page}` : "p.?"))
    )
  );
  return `Sources: ${pages.join("; ")}`;
}

export const retrieveContext = new DynamicStructuredTool({
  name: "retrieve_context",
  description:
    "Retrieve relevant passages for the student's question from the active material (requires materialId).",
  schema: z.object({
    materialId: z.string().min(1),
    question: z.string().min(1),
    k: z.number().int().min(1).max(20).default(8),
  }),
  func: async ({ materialId, question, k }) => {
    const retriever = await getRetrieverForMaterial(materialId, k);
    const docs = await retriever.getRelevantDocuments(question);
    return JSON.stringify({
      context: clamp(docs.map((d) => d.pageContent).join("\n---\n")),
      citations: docsToCitations(docs),
    });
  },
});

export const answerWithContext = new DynamicStructuredTool({
  name: "answer_with_context",
  description:
    "Answer a QUESTION using retrieved CONTEXT. Use citations like [p.X] and end with a Sources line.",
  schema: z.object({
    question: z.string().min(1),
    context: z.string().min(1),
    citations: z
      .array(
        z.object({
          page: z.number().nullable().optional(),
          snippet: z.string().optional(),
        })
      )
      .optional(),
  }),
  func: async ({ question, context, citations }) => {
    const chain = RunnableSequence.from([
      QA_PROMPT,
      model(),
      new StringOutputParser(),
    ]);
    const text = await chain.invoke({ question, context: clamp(context) });
    const norm = normalizeCitations(citations);
    const sources = sourcesFromCitations(norm);
    return JSON.stringify({ text: `${text}\n\n${sources}`, citations: norm });
  },
});

export const summarizeContext = new DynamicStructuredTool({
  name: "summarize_context",
  description: "Summarize the CONTEXT (e.g., a chapter).",
  schema: z.object({ context: z.string().min(1) }),
  func: async ({ context }) => {
    const chain = RunnableSequence.from([
      SUMMARIZE_PROMPT,
      model(),
      new StringOutputParser(),
    ]);
    const text = await chain.invoke({ context: clamp(context) });
    return JSON.stringify({ text });
  },
});

export const quizFromContext = new DynamicStructuredTool({
  name: "quiz_from_context",
  description: "Generate MCQ quiz items from CONTEXT for practice.",
  schema: z.object({
    context: z.string().min(1),
    n: z.number().int().min(3).max(20).default(5),
  }),
  func: async ({ context, n }) => {
    const chain = RunnableSequence.from([
      QUIZ_PROMPT,
      model(),
      new StringOutputParser(),
    ]);
    const text = await chain.invoke({ context: clamp(context), n });
    return JSON.stringify({ text });
  },
});

export const ALL_TOOLS = [
  retrieveContext,
  answerWithContext,
  summarizeContext,
  quizFromContext,
];

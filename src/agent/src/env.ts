// src/env.ts
import "dotenv/config";

type ChatProvider = "groq" | "openai";
type EmbedProvider = "hf_inference" | "hf_local";

// pick provider first so we can choose a sensible default model
const EMBED_PROVIDER = (process.env.EMBED_PROVIDER ?? "hf_local") as EmbedProvider;

// If user didn't set HF_EMBED_MODEL, choose a good default per provider
const HF_EMBED_MODEL =
  process.env.HF_EMBED_MODEL ??
  (EMBED_PROVIDER === "hf_local"
    ? "Xenova/all-MiniLM-L6-v2" // optimized for @xenova/transformers
    : "sentence-transformers/all-MiniLM-L6-v2"); // ideal for HF Inference API

export const ENV = {
  // chat
  CHAT_PROVIDER: (process.env.CHAT_PROVIDER ?? "groq") as ChatProvider,
  CHAT_MODEL: process.env.CHAT_MODEL ?? "openai/gpt-oss-20b",
  GROQ_API_KEY: process.env.GROQ_API_KEY ?? "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",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,  

  // embeddings (Hugging Face ONLY)
  EMBED_PROVIDER,
  HF_EMBED_MODEL,
  HF_TOKEN: process.env.HF_TOKEN,              // required if EMBED_PROVIDER === "hf_inference"

  // server
  PORT: Number(process.env.PORT ?? 5001),
} as const;

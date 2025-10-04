// src/agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { ENV } from "./env.js";
import { ALL_TOOLS } from "./tools.js";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const AGENT_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are CampusFlow's Agentic RAG for School LMS.
Use tools to retrieve context, answer with citations like [p.X], summarize, or quiz.
Always include materialId when required. Prefer retrieve_context -> (answer | summarize | quiz).`
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  // REQUIRED for tools agents
  new MessagesPlaceholder("agent_scratchpad"),
]);

function chatModel() {
  const model = ENV.CHAT_MODEL;

  if (ENV.CHAT_PROVIDER === "groq") {
    if (!ENV.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
    return new ChatGroq({ model, apiKey: ENV.GROQ_API_KEY });
  }

  if (ENV.CHAT_PROVIDER === "openai") {
    if (!ENV.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    return new ChatOpenAI({ model, apiKey: ENV.OPENAI_API_KEY });
  }

  throw new Error(`Unsupported CHAT_PROVIDER: ${ENV.CHAT_PROVIDER}. Use 'groq' or 'openai'.`);
}

export async function getAgentExecutor(): Promise<AgentExecutor> {
  const agent = await createOpenAIFunctionsAgent({
    llm: chatModel() as any,
    tools: ALL_TOOLS,
    prompt: AGENT_PROMPT,
  });
  return new AgentExecutor({ agent, tools: ALL_TOOLS });
}

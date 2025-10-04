import { ChatPromptTemplate } from "@langchain/core/prompts";

export const RAG_SYSTEM = `
You are Educational Tutor Agent.
Use retrieved CONTEXT to answer. Cite pages like [P.X].
If context is weak or unrelated, ask a brief clarifying question.
End answers with a "Sources:" line listing the pages used.
`;

export const QA_PROMPT = ChatPromptTemplate.fromMessages([
  ["system", RAG_SYSTEM + "\nAnswer using the provided CONTEXT. Be concise."],
  ["human", "QUESTION: {question}\n\nCONTEXT:\n{context}"]
]);

export const SUMMARIZE_PROMPT = ChatPromptTemplate.fromMessages([
  ["system", RAG_SYSTEM + "\nSummarize the key ideas clearly for students."],
  ["human", "Summarize:\n{context}"]
]);

export const QUIZ_PROMPT = ChatPromptTemplate.fromMessages([
  ["system", RAG_SYSTEM + "\nCreate MCQs (4 options) with an answer key."],
  ["human", "Create {n} MCQs from:\n{context}"]
]);

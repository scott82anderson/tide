/**
 * Sales Engineer: answers technical, integration, security and data questions
 * from the knowledge base (product docs, API docs, security policy, past RFP
 * answers). Every answer cites the documents it relies on; a question the
 * documents do not cover is flagged for a human rather than answered.
 */

import { MODEL_STRONG } from "@/lib/ai/anthropic";
import { BRAND_VOICE } from "../brand-voice";
import { KNOWLEDGE, KNOWLEDGE_BY_ID } from "../knowledge";
import { RfpAnswersSchema, type RfpAnswers } from "../schemas";
import { AgentBlockedError, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `${BRAND_VOICE}

You answer RFP, security questionnaire and technical questions about the Service Writer using only the documents provided. Cite the document ids you relied on. If the documents do not answer a question, say so, set needsHuman to true and write what a human must confirm. Never guess at a certification, a number or a commitment that is not in a document.`;

export interface SalesEngineerInput {
  questions: string[];
  accountId?: string | null;
}

export interface SalesEngineerOutput {
  answers: (RfpAnswers["answers"][number] & { citedDocs: { id: string; title: string }[] })[];
  docsAvailable: number;
}

export const salesEngineer: AgentDefinition<SalesEngineerInput, SalesEngineerOutput> = {
  key: "sales_engineer",
  name: "Sales Engineer",
  job: "Answer technical, integration, security and data questions",
  inputs: "Product docs, API docs, security policies, past RFP answers",
  output: "Drafted responses, RFP and security questionnaire completion",
  owner: "Solutions lead",
  modelTier: "strong",
  needsAccount: false,
  async run(ctx, input, account): Promise<AgentResult<SalesEngineerOutput>> {
    const ai = requireAi(ctx);
    const questions = input.questions.map((q) => q.trim()).filter(Boolean);
    if (questions.length === 0) throw new AgentBlockedError("Paste at least one question.");

    const { output, latencyMs, model } = await ai.call({
      name: "answer_questions",
      description: "Answer each question from the documents.",
      system: SYSTEM,
      model: MODEL_STRONG,
      maxTokens: 4000,
      schema: RfpAnswersSchema,
      user: JSON.stringify({ questions, documents: KNOWLEDGE.map((d) => ({ id: d.id, title: d.title, kind: d.kind, body: d.body })) }, null, 2),
    });

    const notes: string[] = [];
    const answers = output.answers.map((a) => {
      const valid = a.citedDocIds.filter((id) => KNOWLEDGE_BY_ID.has(id));
      if (valid.length !== a.citedDocIds.length) notes.push(`Dropped unknown citation on "${a.question.slice(0, 40)}"`);
      return { ...a, citedDocIds: valid, citedDocs: valid.map((id) => ({ id, title: KNOWLEDGE_BY_ID.get(id)!.title })) };
    });
    const gaps = answers.filter((a) => a.needsHuman).length;

    return {
      output: { answers, docsAvailable: KNOWLEDGE.length },
      sourceQueries: [],
      steps: [{ step: "answer_from_docs", latencyMs, model }],
      queue: {
        kind: "rfp_answer",
        title: `${questions.length} question(s)${account ? ` for ${account.name}` : ""}${gaps ? `, ${gaps} need a human` : ""}`,
        sourceData: { questions, documents: KNOWLEDGE.map((d) => ({ id: d.id, title: d.title })) },
      },
      contextLine: `Sales Engineer answered ${questions.length} question(s), ${gaps} flagged for a human`,
      notes,
    };
  },
};

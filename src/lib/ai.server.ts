// Server-only: Lovable AI Gateway helpers. Never import from client code.
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { CATEGORIES } from "./civic";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

function provider(apiKey: string) {
  return createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

const reasoningOpts = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;

export const analysisSchema = z.object({
  is_civic_issue: z.boolean(),
  category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]]),
  subcategory: z.string(),
  title: z.string(),
  summary: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  urgency: z.string(),
  confidence: z.number(),
  missing_info: z.string().nullable(),
  safety_warning: z.string().nullable(),
  clarification_question: z.string().nullable(),
});
export type Analysis = z.infer<typeof analysisSchema>;

export class AiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function analyzeIssueWithAI(input: { imageDataUrl?: string | null | undefined; description?: string | null | undefined }): Promise<Analysis> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("AI is not configured", 401);

  const cats = CATEGORIES.map((c) => `${c.id}: ${c.label} (${c.subs.join(", ")})`).join("\n");
  const content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [
    {
      type: "text",
      text: `Citizen description: ${input.description?.trim() || "(none provided)"}\n\nClassify this public infrastructure report from Bengaluru, India.`,
    },
  ];
  if (input.imageDataUrl) content.push({ type: "image", image: new URL(input.imageDataUrl) });

  const result = streamText({
    model: provider(apiKey).responses(MODEL) as never,
    instructions: `You classify civic infrastructure reports for CivicFix, a public issue tracker.
Categories (use the id):
${cats}
Rules:
- title: max 8 words, plain and specific (e.g. "Deep pothole near bus stop").
- summary: 1-2 neutral sentences describing only what is visible or stated. Never identify people, faces or number plates.
- severity: critical only for immediate danger to life (open manhole, exposed live wire, fallen tree on road). Be conservative.
- confidence: 0 to 1.
- If the photo does not show a civic infrastructure problem, set is_civic_issue false, category "other", confidence below 0.4 and ask a clarification_question.
- safety_warning: short advice to keep away if dangerous, otherwise null.`,
    messages: [{ role: "user", content }],
    output: Output.object({ schema: analysisSchema }),
    providerOptions: reasoningOpts,
  });

  try {
    const out = await result.output;
    return { ...out, confidence: Math.max(0, Math.min(1, out.confidence)) };
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new AiError("AI returned an unreadable answer", 502);
    const status = (e as { statusCode?: number })?.statusCode ?? 500;
    throw new AiError((e as Error)?.message || "AI request failed", status);
  }
}

// Deterministic keyword fallback when AI is unavailable.
export function fallbackAnalysis(description?: string | null): Analysis {
  const d = (description || "").toLowerCase();
  const rules: [string, string, string[]][] = [
    ["roads", "Pothole", ["pothole", "road", "footpath", "manhole", "gadda"]],
    ["electricity", "Streetlight not working", ["light", "lamp", "wire", "pole", "electric"]],
    ["water", "Pipe leakage", ["water", "leak", "pipe", "supply"]],
    ["drainage", "Blocked drain", ["drain", "sewage", "flood", "waterlog", "gutter"]],
    ["waste", "Overflowing bin", ["garbage", "waste", "trash", "bin", "dump", "kasa"]],
    ["transport", "Signal not working", ["signal", "traffic", "bus", "parking"]],
    ["trees", "Fallen tree", ["tree", "branch"]],
    ["parks", "Unmaintained park", ["park", "bench", "playground"]],
    ["sanitation", "Unclean toilet", ["toilet", "urinal"]],
  ];
  const hit = rules.find(([, , kws]) => kws.some((k) => d.includes(k)));
  return {
    is_civic_issue: true,
    category: hit?.[0] ?? "other",
    subcategory: hit?.[1] ?? "Other",
    title: hit ? hit[1] : "Civic issue reported",
    summary: description?.trim().slice(0, 240) || "Citizen-submitted photo awaiting review.",
    severity: "medium",
    urgency: "Standard",
    confidence: hit ? 0.35 : 0.1,
    missing_info: null,
    safety_warning: null,
    clarification_question: hit ? null : "What kind of problem is shown in the photo?",
  };
}

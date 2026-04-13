import { env } from "../config/env";
import { getSupabaseAdminClient } from "../lib/supabase";
import { getListingById, getReportById, listMessagesForListing } from "./platform.service";
import type { AuthUser } from "../types/auth";
import type { AiDiagnosticsSummary, AiProviderEvent } from "../types/marketplace";

interface ListingAssistInput {
  title: string;
  description: string;
  category?: string;
  price?: number;
}

interface ListingModerationInput {
  title: string;
  description: string;
  category?: string;
  price?: number;
}

interface ChatModerationInput {
  listingId?: string;
  message: string;
}

interface SearchAssistInput {
  query: string;
}

async function recordAiArtifact(input: {
  artifactType: string;
  subjectType: string;
  subjectId: string;
  source: string;
  payload: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  const { error } = await supabase.from("ai_artifacts").insert({
    artifact_type: input.artifactType,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    source: input.source,
    payload: input.payload,
  });
  if (error) {
    console.error("Failed to persist ai_artifact", error.message);
  }
}

async function recordAiProviderEvent(input: {
  provider: string;
  operation: string;
  model?: string;
  status: AiProviderEvent["status"];
  usedFallback?: boolean;
  httpStatus?: number;
  latencyMs?: number;
  subjectType: string;
  subjectId: string;
  errorMessage?: string;
  requestMeta?: Record<string, unknown>;
  responseMeta?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  const { error } = await supabase.from("ai_provider_events").insert({
    provider: input.provider,
    operation: input.operation,
    model: input.model ?? null,
    status: input.status,
    used_fallback: input.usedFallback ?? false,
    http_status: input.httpStatus ?? null,
    latency_ms: input.latencyMs ?? null,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    error_message: input.errorMessage ?? null,
    request_meta: input.requestMeta ?? {},
    response_meta: input.responseMeta ?? {},
  });
  if (error) {
    console.error("Failed to persist ai_provider_event", error.message);
  }
}

export async function listAiArtifacts(limit = 50) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ai_artifacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) return [];
  return data ?? [];
}

export async function listAiProviderEvents(limit = 50): Promise<AiProviderEvent[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ai_provider_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    provider: row.provider,
    operation: row.operation,
    model: row.model,
    status: row.status,
    usedFallback: !!row.used_fallback,
    httpStatus: row.http_status,
    latencyMs: row.latency_ms,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    errorMessage: row.error_message,
    requestMeta: row.request_meta ?? {},
    responseMeta: row.response_meta ?? {},
    createdAt: row.created_at,
  }));
}

export async function getAiDiagnosticsSummary(limit = 40): Promise<AiDiagnosticsSummary> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      totalRequests: 0,
      successCount: 0,
      fallbackCount: 0,
      providerErrorCount: 0,
      timeoutCount: 0,
      parseErrorCount: 0,
      configBypassCount: 0,
      avgLatencyMs: 0,
      successRate: 0,
      fallbackRate: 0,
      lastEventAt: null,
      byOperation: [],
      recentEvents: [],
      dailyTrends: [],
    };
  }

  const [recentEvents, dailyRows] = await Promise.all([
    listAiProviderEvents(limit),
    supabase.from("ai_provider_daily_v1").select("*").order("day", { ascending: false }).limit(30),
  ]);

  const totalRequests = recentEvents.length;
  const successCount = recentEvents.filter((item) => item.status === "success").length;
  const fallbackCount = recentEvents.filter((item) => item.usedFallback).length;
  const providerErrorCount = recentEvents.filter((item) => item.status === "provider_error").length;
  const timeoutCount = recentEvents.filter((item) => item.status === "timeout").length;
  const parseErrorCount = recentEvents.filter((item) => item.status === "parse_error").length;
  const configBypassCount = recentEvents.filter((item) => item.status === "config_bypass").length;
  const avgLatencyMs =
    recentEvents.filter((item) => typeof item.latencyMs === "number").reduce((sum, item) => sum + Number(item.latencyMs ?? 0), 0) /
    Math.max(recentEvents.filter((item) => typeof item.latencyMs === "number").length, 1);

  const operationMap = new Map<string, { totalRequests: number; successCount: number; fallbackCount: number; latencySum: number; latencyCount: number }>();
  for (const event of recentEvents) {
    const bucket = operationMap.get(event.operation) ?? {
      totalRequests: 0,
      successCount: 0,
      fallbackCount: 0,
      latencySum: 0,
      latencyCount: 0,
    };
    bucket.totalRequests += 1;
    if (event.status === "success") bucket.successCount += 1;
    if (event.usedFallback) bucket.fallbackCount += 1;
    if (typeof event.latencyMs === "number") {
      bucket.latencySum += Number(event.latencyMs);
      bucket.latencyCount += 1;
    }
    operationMap.set(event.operation, bucket);
  }

  if (dailyRows.error) {
    return {
      totalRequests,
      successCount,
      fallbackCount,
      providerErrorCount,
      timeoutCount,
      parseErrorCount,
      configBypassCount,
      avgLatencyMs: Number.isFinite(avgLatencyMs) ? Number(avgLatencyMs.toFixed(2)) : 0,
      successRate: totalRequests ? Number(((successCount / totalRequests) * 100).toFixed(2)) : 0,
      fallbackRate: totalRequests ? Number(((fallbackCount / totalRequests) * 100).toFixed(2)) : 0,
      lastEventAt: recentEvents[0]?.createdAt ?? null,
      byOperation: [...operationMap.entries()].map(([operation, bucket]) => ({
        operation,
        totalRequests: bucket.totalRequests,
        successCount: bucket.successCount,
        fallbackCount: bucket.fallbackCount,
        avgLatencyMs: bucket.latencyCount ? Number((bucket.latencySum / bucket.latencyCount).toFixed(2)) : 0,
      })),
      recentEvents,
      dailyTrends: [],
    };
  }

  return {
    totalRequests,
    successCount,
    fallbackCount,
    providerErrorCount,
    timeoutCount,
    parseErrorCount,
    configBypassCount,
    avgLatencyMs: Number.isFinite(avgLatencyMs) ? Number(avgLatencyMs.toFixed(2)) : 0,
    successRate: totalRequests ? Number(((successCount / totalRequests) * 100).toFixed(2)) : 0,
    fallbackRate: totalRequests ? Number(((fallbackCount / totalRequests) * 100).toFixed(2)) : 0,
    lastEventAt: recentEvents[0]?.createdAt ?? null,
    byOperation: [...operationMap.entries()].map(([operation, bucket]) => ({
      operation,
      totalRequests: bucket.totalRequests,
      successCount: bucket.successCount,
      fallbackCount: bucket.fallbackCount,
      avgLatencyMs: bucket.latencyCount ? Number((bucket.latencySum / bucket.latencyCount).toFixed(2)) : 0,
    })),
    recentEvents,
    dailyTrends: (dailyRows.data ?? []).map((row: any) => ({
      date: String(row.day),
      totalRequests: Number(row.total_requests ?? 0),
      successCount: Number(row.success_count ?? 0),
      fallbackCount: Number(row.fallback_count ?? 0),
      providerErrorCount: Number(row.provider_error_count ?? 0),
      timeoutCount: Number(row.timeout_count ?? 0),
      parseErrorCount: Number(row.parse_error_count ?? 0),
      avgLatencyMs: Number(row.avg_latency_ms ?? 0),
    })),
  };
}

function shouldUseMockAi() {
  const apiKey = String(env.CHUTES_API_KEY || "").trim().toLowerCase();
  return !apiKey || apiKey.includes("placeholder");
}

function inferCategory(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("cycle") || normalized.includes("bicycle")) return "cycle";
  if (normalized.includes("book") || normalized.includes("textbook")) return "books";
  if (normalized.includes("kettle") || normalized.includes("hostel")) return "hostel-essentials";
  return "electronics";
}

function extractTags(text: string) {
  const candidates = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  return [...new Set(candidates)].slice(0, 6);
}

function inferSearchMode(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("rent") || normalized.includes("borrow")) return "rent";
  if (normalized.includes("bundle") || normalized.includes("set")) return "bundle";
  return "sale";
}

function scoreRisk(text: string) {
  const normalized = text.toLowerCase();
  let score = 18;
  const flags: string[] = [];

  if (normalized.includes("advance") || normalized.includes("pay first")) {
    score += 35;
    flags.push("advance_payment_request");
  }
  if (normalized.includes("urgent") || normalized.includes("immediately")) {
    score += 10;
    flags.push("pressure_language");
  }
  if (normalized.includes("outside app") || normalized.includes("whatsapp")) {
    score += 20;
    flags.push("off_platform_push");
  }
  if (normalized.includes("weapon") || normalized.includes("substance")) {
    score += 45;
    flags.push("prohibited_item_hint");
  }

  return {
    score: Math.min(score, 100),
    flags,
  };
}

function normalizeChutesContent(content: unknown): string | undefined {
  if (typeof content === "string") {
    return content.trim() || undefined;
  }

  if (Array.isArray(content)) {
    const stitched = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("\n")
      .trim();
    return stitched || undefined;
  }

  return undefined;
}

async function callChutes(systemPrompt: string, userPrompt: string) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.CHUTES_TIMEOUT_SECONDS * 1000);

    try {
      const response = await fetch(`${env.CHUTES_BASE_URL}${env.CHUTES_COMPLETIONS_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.CHUTES_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.CHUTES_MODEL,
          temperature: 0.2,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`Chutes request failed with ${response.status}`) as Error & { httpStatus?: number };
        error.httpStatus = response.status;
        if (response.status >= 500 && attempt === 0) {
          lastError = error;
          continue;
        }
        throw error;
      }

      const payload = await response.json();
      return {
        content: normalizeChutesContent(payload.choices?.[0]?.message?.content),
        httpStatus: response.status,
      };
    } catch (error) {
      lastError = error;
      const status = typeof (error as { httpStatus?: unknown })?.httpStatus === "number" ? Number((error as { httpStatus: number }).httpStatus) : null;
      const retryable =
        error instanceof Error &&
        (error.name === "AbortError" ||
          status === null ||
          status >= 500 ||
          /fetch failed|network/i.test(error.message));

      if (attempt === 0 && retryable) {
        continue;
      }

      throw error;
    } finally {
        clearTimeout(timeout);
    }
  }

  throw (lastError instanceof Error ? lastError : new Error("Chutes request failed"));
}

function extractJsonObject<T>(content: string): T | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(content.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export async function getListingAssist(input: ListingAssistInput) {
  const startedAt = Date.now();
  const subjectId = input.title.slice(0, 80) || "draft";
  const fallback = {
    source: "heuristic",
    improvedTitle: `${input.title.trim()} | SRM KTR Ready Deal`,
    improvedDescription: `${input.description.trim()} Pickup or meetup available on campus. Condition and price can be discussed clearly in chat before confirming the deal.`,
    suggestedCategory: input.category || inferCategory(`${input.title} ${input.description}`),
    suggestedTags: extractTags(`${input.title} ${input.description}`),
    priceGuidance: input.price
      ? `Current ask is Rs. ${input.price}. Consider a buyer-friendly band of Rs. ${Math.max(input.price - 100, 0)} to Rs. ${input.price + 150}.`
      : "Add a price once you compare similar campus listings.",
    missingDetails: ["brand or model", "pickup window", "visible defects or wear"],
  };

  if (shouldUseMockAi()) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "listing_assist",
      model: env.CHUTES_MODEL,
      status: "config_bypass",
      usedFallback: true,
      latencyMs: Date.now() - startedAt,
      subjectType: "listing_draft",
      subjectId,
      requestMeta: { input },
      responseMeta: { reason: "missing_or_placeholder_chutes_key" },
    });
    await recordAiArtifact({
      artifactType: "listing_assist",
      subjectType: "listing_draft",
      subjectId,
      source: "heuristic",
      payload: {
        reason: "missing_or_placeholder_chutes_key",
        model: env.CHUTES_MODEL,
        input,
        result: fallback,
        latencyMs: Date.now() - startedAt,
      },
    });
    return fallback;
  }

  try {
    const response = await callChutes(
      "You improve secondhand marketplace listings. Return strict JSON only.",
      `Return JSON with keys improvedTitle, improvedDescription, suggestedCategory, suggestedTags, priceGuidance, missingDetails for this listing: ${JSON.stringify(input)}`,
    );

    if (!response.content) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "listing_assist",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "listing_draft",
        subjectId,
        requestMeta: { input },
        responseMeta: { reason: "empty_content" },
      });
      return fallback;
    }

    const parsed = extractJsonObject<typeof fallback>(response.content);
    if (!parsed) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "listing_assist",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "listing_draft",
        subjectId,
        requestMeta: { input },
        responseMeta: { reason: "invalid_json" },
      });
      return fallback;
    }

    const result = {
      ...parsed,
      source: "chutes",
    };
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "listing_assist",
      model: env.CHUTES_MODEL,
      status: "success",
      usedFallback: false,
      httpStatus: response.httpStatus,
      latencyMs: Date.now() - startedAt,
      subjectType: "listing_draft",
      subjectId,
      requestMeta: { input },
      responseMeta: { improvedTitle: result.improvedTitle, suggestedCategory: result.suggestedCategory, tagCount: result.suggestedTags?.length ?? 0 },
    });
    await recordAiArtifact({
      artifactType: "listing_assist",
      subjectType: "listing_draft",
      subjectId,
      source: "chutes",
      payload: {
        model: env.CHUTES_MODEL,
        input,
        result,
        latencyMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (error) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "listing_assist",
      model: env.CHUTES_MODEL,
      status: error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_error",
      usedFallback: true,
      httpStatus: typeof (error as any)?.httpStatus === "number" ? (error as any).httpStatus : undefined,
      latencyMs: Date.now() - startedAt,
      subjectType: "listing_draft",
      subjectId,
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      requestMeta: { input },
    });
    await recordAiArtifact({
      artifactType: "listing_assist",
      subjectType: "listing_draft",
      subjectId,
      source: "heuristic",
      payload: {
        reason: "provider_error",
        model: env.CHUTES_MODEL,
        input,
        result: fallback,
        latencyMs: Date.now() - startedAt,
      },
    });
    return fallback;
  }
}

export async function moderateListingContent(input: ListingModerationInput) {
  const startedAt = Date.now();
  const subjectId = input.title.slice(0, 80) || "draft";
  const heuristic = scoreRisk(`${input.title} ${input.description}`);
  const fallback = {
    source: "heuristic",
    riskScore: heuristic.score,
    riskLevel: heuristic.score >= 65 ? "high" : heuristic.score >= 35 ? "medium" : "low",
    flags: heuristic.flags,
    summary:
      heuristic.flags.length > 0
        ? "This listing contains patterns worth manual review before trust is assumed."
        : "No strong scam or policy indicators were found in the provided listing text.",
    recommendedAction: heuristic.score >= 65 ? "manual_review" : "allow_with_watch",
  };

  if (shouldUseMockAi()) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "listing_moderation",
      model: env.CHUTES_MODEL,
      status: "config_bypass",
      usedFallback: true,
      latencyMs: Date.now() - startedAt,
      subjectType: "listing_draft",
      subjectId,
      requestMeta: { input },
      responseMeta: { reason: "missing_or_placeholder_chutes_key" },
    });
    await recordAiArtifact({
      artifactType: "listing_moderation",
      subjectType: "listing_draft",
      subjectId,
      source: "heuristic",
      payload: {
        reason: "missing_or_placeholder_chutes_key",
        model: env.CHUTES_MODEL,
        input,
        result: fallback,
        latencyMs: Date.now() - startedAt,
      },
    });
    return fallback;
  }

  try {
    const response = await callChutes(
      "You are a marketplace safety model. Return strict JSON only.",
      `Evaluate this listing for scam, abuse, prohibited item, and suspicious payment risk. Return JSON with keys riskScore, riskLevel, flags, summary, recommendedAction. Listing: ${JSON.stringify(input)}`,
    );

    if (!response.content) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "listing_moderation",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "listing_draft",
        subjectId,
        requestMeta: { input },
        responseMeta: { reason: "empty_content" },
      });
      return fallback;
    }

    const parsed = extractJsonObject<typeof fallback>(response.content);
    if (!parsed) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "listing_moderation",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "listing_draft",
        subjectId,
        requestMeta: { input },
        responseMeta: { reason: "invalid_json" },
      });
      return fallback;
    }

    const result = {
      ...parsed,
      source: "chutes",
    };
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "listing_moderation",
      model: env.CHUTES_MODEL,
      status: "success",
      usedFallback: false,
      httpStatus: response.httpStatus,
      latencyMs: Date.now() - startedAt,
      subjectType: "listing_draft",
      subjectId,
      requestMeta: { input },
      responseMeta: { riskScore: result.riskScore, riskLevel: result.riskLevel },
    });
    await recordAiArtifact({
      artifactType: "listing_moderation",
      subjectType: "listing_draft",
      subjectId,
      source: "chutes",
      payload: {
        model: env.CHUTES_MODEL,
        input,
        result,
        latencyMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (error) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "listing_moderation",
      model: env.CHUTES_MODEL,
      status: error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_error",
      usedFallback: true,
      httpStatus: typeof (error as any)?.httpStatus === "number" ? (error as any).httpStatus : undefined,
      latencyMs: Date.now() - startedAt,
      subjectType: "listing_draft",
      subjectId,
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      requestMeta: { input },
    });
    await recordAiArtifact({
      artifactType: "listing_moderation",
      subjectType: "listing_draft",
      subjectId,
      source: "heuristic",
      payload: {
        reason: "provider_error",
        model: env.CHUTES_MODEL,
        input,
        result: fallback,
        latencyMs: Date.now() - startedAt,
      },
    });
    return fallback;
  }
}

export async function moderateChatMessage(input: ChatModerationInput) {
  const startedAt = Date.now();
  const subjectId = input.listingId || "ad-hoc";
  const heuristic = scoreRisk(input.message);
  const fallback = {
    source: "heuristic",
    riskScore: heuristic.score,
    flags: heuristic.flags,
    warning:
      heuristic.score >= 45
        ? "Be careful with advance payments or pressure-heavy requests. Keep the transaction on-platform and meet publicly."
        : "Message looks mostly safe, but keep payment and meetup coordination cautious.",
    safeReplySuggestion:
      heuristic.score >= 45
        ? "I prefer to inspect the item in person before making any payment."
        : "Can we confirm the condition and a safe campus meetup spot first?",
  };

  if (shouldUseMockAi()) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "chat_moderation",
      model: env.CHUTES_MODEL,
      status: "config_bypass",
      usedFallback: true,
      latencyMs: Date.now() - startedAt,
      subjectType: "conversation",
      subjectId,
      requestMeta: { input },
      responseMeta: { reason: "missing_or_placeholder_chutes_key" },
    });
    await recordAiArtifact({
      artifactType: "chat_moderation",
      subjectType: "conversation",
      subjectId,
      source: "heuristic",
      payload: {
        reason: "missing_or_placeholder_chutes_key",
        model: env.CHUTES_MODEL,
        input,
        result: fallback,
        latencyMs: Date.now() - startedAt,
      },
    });
    return fallback;
  }

  try {
    const response = await callChutes(
      "You are a chat safety classifier for a student marketplace. Return strict JSON only.",
      `Review this chat message for scam or abuse risk. Return JSON with keys riskScore, flags, warning, safeReplySuggestion. Context: ${JSON.stringify(input)}`,
    );

    if (!response.content) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "chat_moderation",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "conversation",
        subjectId,
        requestMeta: { input },
        responseMeta: { reason: "empty_content" },
      });
      return fallback;
    }

    const parsed = extractJsonObject<typeof fallback>(response.content);
    if (!parsed) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "chat_moderation",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "conversation",
        subjectId,
        requestMeta: { input },
        responseMeta: { reason: "invalid_json" },
      });
      return fallback;
    }

    const result = {
      ...parsed,
      source: "chutes",
    };
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "chat_moderation",
      model: env.CHUTES_MODEL,
      status: "success",
      usedFallback: false,
      httpStatus: response.httpStatus,
      latencyMs: Date.now() - startedAt,
      subjectType: "conversation",
      subjectId,
      requestMeta: { input },
      responseMeta: { riskScore: result.riskScore, flagCount: result.flags?.length ?? 0 },
    });
    await recordAiArtifact({
      artifactType: "chat_moderation",
      subjectType: "conversation",
      subjectId,
      source: "chutes",
      payload: {
        model: env.CHUTES_MODEL,
        input,
        result,
        latencyMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (error) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "chat_moderation",
      model: env.CHUTES_MODEL,
      status: error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_error",
      usedFallback: true,
      httpStatus: typeof (error as any)?.httpStatus === "number" ? (error as any).httpStatus : undefined,
      latencyMs: Date.now() - startedAt,
      subjectType: "conversation",
      subjectId,
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      requestMeta: { input },
    });
    await recordAiArtifact({
      artifactType: "chat_moderation",
      subjectType: "conversation",
      subjectId,
      source: "heuristic",
      payload: {
        reason: "provider_error",
        model: env.CHUTES_MODEL,
        input,
        result: fallback,
        latencyMs: Date.now() - startedAt,
      },
    });
    return fallback;
  }
}

export async function summarizeReportForAdmin(reportId: string, user: AuthUser) {
  const startedAt = Date.now();
  const report = await getReportById(reportId);

  if (!report) {
    return null;
  }

  const listing = await getListingById(report.targetId, user);
  const messages = (await listMessagesForListing(report.targetId, user))?.slice(-5) ?? [];
  const fallback = {
    source: "heuristic",
    priority: report.severity === "high" ? "urgent" : report.severity === "medium" ? "high" : "normal",
    summary: `Report ${report.id} alleges ${report.reason} on listing ${report.targetId}.`,
    supportingSignals: [
      `Severity: ${report.severity}`,
      listing ? `Listing status: ${listing.status}` : "Listing context unavailable",
      report.details || "No extra reporter notes",
    ],
    suggestedAction:
      report.severity === "high" ? "hide_listing" : report.severity === "medium" ? "warn_user" : "monitor",
    recentChatContext: messages.map((message: any) => message.text),
  };

  if (shouldUseMockAi()) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "report_summary",
      model: env.CHUTES_MODEL,
      status: "config_bypass",
      usedFallback: true,
      subjectType: "report",
      subjectId: reportId,
      requestMeta: { reportId },
      responseMeta: { reason: "missing_or_placeholder_chutes_key" },
    });
    await recordAiArtifact({
      artifactType: "report_summary",
      subjectType: "report",
      subjectId: reportId,
      source: "heuristic",
      payload: {
        reason: "missing_or_placeholder_chutes_key",
        model: env.CHUTES_MODEL,
        result: fallback,
      },
    });
    return fallback;
  }

  try {
    const response = await callChutes(
      "You summarize marketplace reports for human admins. Return strict JSON only.",
      `Return JSON with keys priority, summary, supportingSignals, suggestedAction, recentChatContext using this report context: ${JSON.stringify({ report, listing, messages })}`,
    );

    if (!response.content) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "report_summary",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "report",
        subjectId: reportId,
        requestMeta: { reportId },
        responseMeta: { reason: "empty_content" },
      });
      return fallback;
    }

    const parsed = extractJsonObject<typeof fallback>(response.content);
    if (!parsed) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "report_summary",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "report",
        subjectId: reportId,
        requestMeta: { reportId },
        responseMeta: { reason: "invalid_json" },
      });
      return fallback;
    }

    const result = {
      ...parsed,
      source: "chutes",
    };
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "report_summary",
      model: env.CHUTES_MODEL,
      status: "success",
      usedFallback: false,
      httpStatus: response.httpStatus,
      latencyMs: Date.now() - startedAt,
      subjectType: "report",
      subjectId: reportId,
      requestMeta: { reportId },
      responseMeta: { priority: result.priority, suggestedAction: result.suggestedAction },
    });
    await recordAiArtifact({
      artifactType: "report_summary",
      subjectType: "report",
      subjectId: reportId,
      source: "chutes",
      payload: {
        model: env.CHUTES_MODEL,
        reportId,
        result,
        latencyMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (error) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "report_summary",
      model: env.CHUTES_MODEL,
      status: error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_error",
      usedFallback: true,
      httpStatus: typeof (error as any)?.httpStatus === "number" ? (error as any).httpStatus : undefined,
      latencyMs: Date.now() - startedAt,
      subjectType: "report",
      subjectId: reportId,
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      requestMeta: { reportId },
    });
    await recordAiArtifact({
      artifactType: "report_summary",
      subjectType: "report",
      subjectId: reportId,
      source: "heuristic",
      payload: {
        reason: "provider_error",
        model: env.CHUTES_MODEL,
        reportId,
        result: fallback,
      },
    });
    return fallback;
  }
}

export async function assistSearchQuery(input: SearchAssistInput) {
  const startedAt = Date.now();
  const subjectId = input.query.slice(0, 80) || "ad-hoc";
  const fallback = {
    source: "heuristic",
    rewrittenQuery: input.query.trim().replace(/\s+/g, " "),
    suggestedCategory: inferCategory(input.query),
    suggestedMode: inferSearchMode(input.query),
    suggestedFilters: {
      deliveryAvailable: input.query.toLowerCase().includes("deliver"),
      condition: input.query.toLowerCase().includes("new") ? "like_new" : undefined,
    },
    guidance:
      "Try scanning both sale and rent options, compare condition and pickup mode, and prefer listings with stronger completeness.",
  };

  if (shouldUseMockAi()) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "search_assist",
      model: env.CHUTES_MODEL,
      status: "config_bypass",
      usedFallback: true,
      latencyMs: Date.now() - startedAt,
      subjectType: "search",
      subjectId,
      requestMeta: { input },
      responseMeta: { reason: "missing_or_placeholder_chutes_key" },
    });
    await recordAiArtifact({
      artifactType: "search_assist",
      subjectType: "search",
      subjectId,
      source: "heuristic",
      payload: {
        reason: "missing_or_placeholder_chutes_key",
        model: env.CHUTES_MODEL,
        input,
        result: fallback,
        latencyMs: Date.now() - startedAt,
      },
    });
    return fallback;
  }

  try {
    const response = await callChutes(
      "You rewrite campus marketplace search queries. Return strict JSON only.",
      `Return JSON with keys rewrittenQuery, suggestedCategory, suggestedMode, suggestedFilters, guidance for this user query: ${JSON.stringify(input)}`,
    );

    if (!response.content) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "search_assist",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "search",
        subjectId,
        requestMeta: { input },
        responseMeta: { reason: "empty_content" },
      });
      return fallback;
    }

    const parsed = extractJsonObject<typeof fallback>(response.content);
    if (!parsed) {
      await recordAiProviderEvent({
        provider: "chutes",
        operation: "search_assist",
        model: env.CHUTES_MODEL,
        status: "parse_error",
        usedFallback: true,
        httpStatus: response.httpStatus,
        latencyMs: Date.now() - startedAt,
        subjectType: "search",
        subjectId,
        requestMeta: { input },
        responseMeta: { reason: "invalid_json" },
      });
      return fallback;
    }

    const result = {
      ...parsed,
      source: "chutes",
    };
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "search_assist",
      model: env.CHUTES_MODEL,
      status: "success",
      usedFallback: false,
      httpStatus: response.httpStatus,
      latencyMs: Date.now() - startedAt,
      subjectType: "search",
      subjectId,
      requestMeta: { input },
      responseMeta: { suggestedCategory: result.suggestedCategory, suggestedMode: result.suggestedMode },
    });
    await recordAiArtifact({
      artifactType: "search_assist",
      subjectType: "search",
      subjectId,
      source: "chutes",
      payload: {
        model: env.CHUTES_MODEL,
        input,
        result,
        latencyMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (error) {
    await recordAiProviderEvent({
      provider: "chutes",
      operation: "search_assist",
      model: env.CHUTES_MODEL,
      status: error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_error",
      usedFallback: true,
      httpStatus: typeof (error as any)?.httpStatus === "number" ? (error as any).httpStatus : undefined,
      latencyMs: Date.now() - startedAt,
      subjectType: "search",
      subjectId,
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      requestMeta: { input },
    });
    await recordAiArtifact({
      artifactType: "search_assist",
      subjectType: "search",
      subjectId,
      source: "heuristic",
      payload: {
        reason: "provider_error",
        model: env.CHUTES_MODEL,
        input,
        result: fallback,
        latencyMs: Date.now() - startedAt,
      },
    });
    return fallback;
  }
}

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Database, Loader2, Send, Sparkles } from "lucide-react";
import {
  askHelpdesk,
  getHelpdeskCapabilities,
  type EvidenceRow,
  type HelpdeskIntent,
  type HelpdeskResponse,
} from "../api/helpdesk";
import { useAuth } from "../context/AuthContext";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  response?: HelpdeskResponse;
}

const INTENT_LABELS: Record<HelpdeskIntent, string> = {
  highest_stockout_risk: "Stock-out risk",
  expiry_risk: "Expiry risk",
  inventory_lookup: "Inventory lookup",
  demand_forecast: "Demand forecast",
  procurement_recommendations: "Procurement recommendation",
  risk_explanation: "Risk explanation",
  helpdesk_capabilities: "Capabilities",
  limitation: "Out of scope",
};

const INTENT_BADGE: Record<HelpdeskIntent, string> = {
  highest_stockout_risk: "bg-rose-50 text-rose-700 border-rose-200 dark:text-rose-300 dark:border-rose-800",
  expiry_risk: "bg-amber-50 text-amber-800 border-amber-200 dark:text-amber-200 dark:border-amber-800",
  inventory_lookup: "bg-sky-50 text-sky-800 border-sky-200 dark:text-sky-200 dark:border-sky-800",
  demand_forecast: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:text-indigo-200 dark:border-indigo-800",
  procurement_recommendations: "bg-violet-50 text-violet-800 border-violet-200",
  risk_explanation: "bg-teal-50 text-teal-800 border-teal-200 dark:text-teal-200 dark:border-teal-800",
  helpdesk_capabilities: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800",
  limitation: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800",
};

/** Ordered label pairs for every evidence field a row may carry. */
const EVIDENCE_FIELDS: Array<[keyof EvidenceRow, string]> = [
  ["hospital", "Hospital"],
  ["medicine", "Medicine"],
  ["risk", "Risk"],
  ["urgency", "Urgency"],
  ["total_quantity", "Total units"],
  ["quantity", "Quantity"],
  ["suggested_quantity", "Suggested order"],
  ["potential_wastage", "Potential waste"],
  ["days_of_supply", "Days of supply"],
  ["daily_demand", "Daily demand"],
  ["expected_daily_demand", "Expected daily demand"],
  ["projected_stockout_date", "Projected stock-out"],
  ["expiry_date", "Expiry"],
  ["days_to_expiry", "Days to expiry"],
  ["date", "Date"],
  ["predicted_demand", "Predicted demand"],
  ["supplier", "Supplier"],
  ["supplier_lead_time_days", "Lead time (days)"],
  ["reason", "Reason"],
  ["detail", "Detail"],
];

const MAX_EVIDENCE = 8;

const STARTER_QUESTIONS = [
  "Which medicines are at highest stock-out risk?",
  "Which batches are about to expire?",
  "What should I reorder next week?",
];

function errorFor(err: unknown): string {
  if (err instanceof Error && /Helpdesk request failed: 503/.test(err.message)) {
    return "Helpdesk is temporarily unavailable right now. Please try again in a moment.";
  }
  if (err instanceof Error && /Helpdesk request failed: 502/.test(err.message)) {
    return "The assistant returned an unreadable answer. Please rephrase and try again.";
  }
  if (err instanceof Error && /Helpdesk request failed: 401/.test(err.message)) {
    return "Your session is not authorised for this hospital. Try switching facilities.";
  }
  return err instanceof Error ? err.message : String(err);
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  return String(value);
}

function EvidenceCard({ row }: { row: EvidenceRow }) {
  const hasForecast = row.is_forecast === true;
  return (
    <div
      className={`rounded-xl border bg-white p-3 text-xs shadow-xs ${
        hasForecast ? "border-indigo-200 dark:border-indigo-800" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-900 dark:text-slate-100">{row.medicine ?? row.hospital ?? "MedPredict record"}</span>
        {hasForecast && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
            Forecast
          </span>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {EVIDENCE_FIELDS.map(([key, label]) => {
          const value = row[key];
          if (value === undefined || value === null || value === "" || (key === "is_forecast" && !hasForecast)) {
            return null;
          }
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-300">{formatValue(value)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function AssistantCard({ message, onSuggestion }: { message: ChatMessage; onSuggestion?: (question: string) => void }) {
  const response = message.response;
  if (!response) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-800 shadow-sm dark:text-rose-200 dark:border-rose-800">
        {message.text}
      </div>
    );
  }

  const hiddenEvidence = Math.max(0, response.evidence.length - MAX_EVIDENCE);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-3 dark:bg-slate-900 dark:border-slate-800">
      <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">{response.answer}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${INTENT_BADGE[response.intent]}`}
        >
          {INTENT_LABELS[response.intent]}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800">
          <Database className="h-3 w-3" />
          Data as of {response.data_as_of}
        </span>
      </div>

      {response.evidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Verified MedPredict evidence
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {response.evidence.slice(0, MAX_EVIDENCE).map((row) => (
              <EvidenceCard key={JSON.stringify(row)} row={row} />
            ))}
          </div>
          {hiddenEvidence > 0 && (
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">+{hiddenEvidence} more rows…</p>
          )}
        </div>
      )}

      {response.limitations.map((limitation) => (
        <div
          key={limitation}
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-900 dark:border-amber-800"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>{limitation}</span>
        </div>
      ))}

      {response.suggested_questions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {response.suggested_questions.map((question) => (
            <SuggestionChip key={question} question={question} onClick={() => onSuggestion?.(question)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionChip({ question, onClick }: { question: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-indigo-200 bg-indigo-50/70 px-3 py-1 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:text-indigo-300 dark:border-indigo-800"
    >
      {question}
    </button>
  );
}

export default function Helpdesk() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [starterQuestions, setStarterQuestions] = useState<string[]>(STARTER_QUESTIONS);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getHelpdeskCapabilities(user.id)
      .then((caps) => {
        if (!cancelled && caps.length > 0) {
          const examples = caps.flatMap((c) => c.example_questions ?? []);
          setStarterQuestions((current) => (examples.length ? examples.slice(0, 4) : current));
        }
      })
      .catch(() => {
        // Static starter chips are a fine fallback when the API is down.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, submitting]);

  async function submit(question?: string) {
    const text = (question ?? input).trim();
    if (!text || submitting || !user) return;
    setInput("");
    const userMessage: ChatMessage = { id: nextId.current++, role: "user", text };
    setMessages((current) => [...current, userMessage]);
    setSubmitting(true);
    try {
      const response = await askHelpdesk(user.id, text);
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", text: response.answer, response },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", text: errorFor(err) },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  const hospitalName = user?.name ?? "Hospital A";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          MedPredict Helpdesk
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5 dark:text-slate-400">
          Ask questions in plain language about {hospitalName}'s inventory, forecasts, expiries and
          procurement. Answers are grounded in live MedPredict data for your hospital only.
        </p>
      </div>

      <div className="flex h-[60vh] flex-col rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">How can I help your supply chain?</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Try a starter question below, or ask about a specific medicine, batch or supplier.
                </p>
              </div>
            </div>
          )}

          {messages.map((message) =>
            message.role === "assistant" ? (
              <AssistantCard key={message.id} message={message} onSuggestion={(q) => void submit(q)} />
            ) : (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm">
                  {message.text}
                </div>
              </div>
            ),
          )}

          {submitting && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
              Grounding an answer in verified MedPredict data…
            </div>
          )}
        </div>

        {messages.length === 0 && starterQuestions.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-wrap gap-1.5">
              {starterQuestions.map((question) => (
                <SuggestionChip key={question} onClick={() => void submit(question)} question={question} />
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(event) => handleSubmit(event)}
          className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
        >
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Ask about ${hospitalName}…`}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !input.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}
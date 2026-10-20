"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { z } from "zod";
import { WorkspaceShell } from "../ui/workspace-shell";
import { INVESTIGATION_DRAFT_KEY } from "../payments/investigation-card";
import { customerSchema, type Customer } from "@/lib/db/schemas";
import { readAgentEvents } from "@/lib/agent/events";
import { GUARD_MODEL_LABEL } from "@/lib/security/injection";
import { MAX_MESSAGE_LENGTH } from "@/lib/security/limits";
import { scenarios } from "@/lib/demo/scenarios";
import { CustomerPicker } from "./customer-picker";
import { ScenarioButtons } from "./scenario-buttons";
import { MessageList, type ChatMessage } from "./message-list";

export function ChatWorkspace() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hydratedDraft = useRef(false);
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setConnectionError("");
    try {
      const response = await fetch("/api/customers");
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not load demo customers.",
        );
      const parsed = z
        .object({ customers: z.array(customerSchema) })
        .parse(data);
      setCustomers(parsed.customers);
      setCustomerId((current) =>
        parsed.customers.some((customer) => customer.id === current)
          ? current
          : parsed.customers.find(
              (customer) => customer.id === scenarios[0].customerId,
            )?.id ||
            parsed.customers[0]?.id ||
            "",
      );
      if (!parsed.customers.length)
        setConnectionError(
          "The database is connected but has no demo customers. Run the seed script to add the sample accounts.",
        );
    } catch (cause) {
      setConnectionError(
        cause instanceof Error
          ? cause.message
          : "Could not connect to the demo database.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
    return () => abortRef.current?.abort();
  }, [loadCustomers]);

  useEffect(() => {
    if (!customers.length || hydratedDraft.current) return;
    hydratedDraft.current = true;
    try {
      const saved = sessionStorage.getItem(INVESTIGATION_DRAFT_KEY);
      if (!saved) return;
      const parsed = z
        .object({
          customer_id: z.uuid(),
          message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
        })
        .safeParse(JSON.parse(saved));
      sessionStorage.removeItem(INVESTIGATION_DRAFT_KEY);
      if (
        parsed.success &&
        customers.some((customer) => customer.id === parsed.data.customer_id)
      ) {
        setCustomerId(parsed.data.customer_id);
        setDraft(parsed.data.message);
        inputRef.current?.focus();
      }
    } catch {
      /* Browser storage is optional; never send a draft automatically. */
    }
  }, [customers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [messages]);

  function reset(customer = customerId) {
    if (busy) return;
    setCustomerId(customer);
    setMessages([]);
    setDraft("");
    setError("");
  }

  function chooseScenario(scenario: (typeof scenarios)[number]) {
    reset(scenario.customerId);
    setDraft(scenario.message);
    inputRef.current?.focus();
  }

  async function send() {
    if (busy || !draft.trim() || !selectedCustomer || connectionError) return;
    const text = draft.trim();
    const history = [
      ...messages
        .filter((message) => message.content && !message.failed)
        .map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: text },
    ].slice(-19);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      calls: [],
      step: 0,
    };
    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      calls: [],
      step: 0,
    };
    setMessages((current) => [...current, userMessage, reply]);
    setDraft("");
    setError("");
    setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    const updateReply = (update: (message: ChatMessage) => ChatMessage) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === reply.id ? update(message) : message,
        ),
      );
    let terminalEvent = false;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, messages: history }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "The investigation could not start.",
        );
      }
      if (!response.body)
        throw new Error(
          "The response stream is unavailable. Please try again.",
        );
      for await (const event of readAgentEvents(response.body)) {
        if (event.type === "run_started" && event.model === GUARD_MODEL_LABEL)
          updateReply((message) => ({ ...message, guarded: true }));
        if (event.type === "text_delta")
          updateReply((message) => ({
            ...message,
            content: message.content + event.text,
          }));
        if (event.type === "step_started")
          updateReply((message) => ({ ...message, step: event.step }));
        if (event.type === "tool_started")
          updateReply((message) => ({
            ...message,
            calls: [
              ...message.calls,
              {
                callId: event.callId,
                name: event.name,
                input: event.input,
                status: "running",
              },
            ],
          }));
        if (event.type === "tool_finished")
          updateReply((message) => ({
            ...message,
            calls: message.calls.map((call) =>
              call.callId === event.callId
                ? {
                    ...call,
                    result: event.result,
                    durationMs: event.durationMs,
                    status: event.failed ? "failed" : "done",
                  }
                : call,
            ),
          }));
        if (event.type === "error") {
          terminalEvent = true;
          throw new Error(event.message);
        }
        if (event.type === "done") terminalEvent = true;
      }
      if (!terminalEvent)
        throw new Error(
          "The connection ended before the investigation finished. Please try again.",
        );
    } catch (cause) {
      const message = abort.signal.aborted
        ? "Investigation stopped. Check the approval queue for requests already created. No refund executes without human approval."
        : cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again.";
      setError(message);
      updateReply((reply) => ({
        ...reply,
        content: reply.content || message,
        failed: true,
        calls: reply.calls.map((call) =>
          call.status === "running"
            ? {
                ...call,
                status: "failed",
                result: { error: "Investigation interrupted." },
              }
            : call,
        ),
      }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <WorkspaceShell active="demo">
      <div className="chat-route">
        <main id="main-content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">AI PAYMENT DISPUTE AGENT</span>
              <h1>Payment investigation</h1>
              <p>Let’s find out what happened, and what you can do next.</p>
            </div>
            <span className="phase-badge">
              <span />
              MOCK PAYMENTS · HUMAN CONTROL
            </span>
          </section>
          {connectionError && (
            <div className="connection-notice" role="alert">
              <div>
                <strong>The demo database needs attention</strong>
                <p>{connectionError}</p>
              </div>
              <button onClick={loadCustomers} disabled={loading}>
                {loading ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  "Retry connection"
                )}
              </button>
            </div>
          )}
          <div className="workspace-grid">
            <div className="context-column">
              <CustomerPicker
                customers={customers}
                value={customerId}
                onChange={reset}
                disabled={loading || busy || !customers.length}
              />
              <ScenarioButtons
                onSelect={chooseScenario}
                disabled={
                  busy || loading || !customers.length || !!connectionError
                }
              />
              <div className="how-it-works">
                <span className="how-icon">
                  <LockKeyhole size={17} />
                </span>
                <h3>Investigation, with guardrails.</h3>
                <p>
                  The agent investigates and proposes refunds. A human must
                  approve before any mock refund executes.
                </p>
                <div>
                  <Check size={13} />
                  Four investigation tools + refund requests
                </div>
                <div>
                  <Check size={13} />
                  Visible inputs and results
                </div>
                <div>
                  <Check size={13} />
                  An eight-step investigation limit
                </div>
              </div>
            </div>
            <section
              className="chat-panel"
              aria-label="Payment investigation chat"
            >
              <div className="chat-header">
                <div className="agent-profile">
                  <span className="agent-avatar">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <strong>Resolve assistant</strong>
                    <span>
                      {busy
                        ? "Investigating payment records"
                        : "Your payment investigator"}
                    </span>
                  </div>
                </div>
                <button
                  className="new-chat"
                  onClick={() => reset()}
                  disabled={busy || !messages.length}
                >
                  <Plus size={15} />
                  New chat
                </button>
              </div>
              <MessageList
                messages={messages}
                busy={busy}
                bottomRef={bottomRef}
              />
              <div className="composer-area">
                {error && (
                  <div className="chat-error" role="alert">
                    <span>{error}</span>
                    <button
                      className="icon-button"
                      onClick={() => setError("")}
                      aria-label="Dismiss error"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <form
                  className="composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                  }}
                >
                  <label className="sr-only" htmlFor="message">
                    Describe your payment problem
                  </label>
                  <textarea
                    ref={inputRef}
                    id="message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={MAX_MESSAGE_LENGTH}
                    rows={2}
                    disabled={busy}
                    placeholder="Something not right with a payment? Tell me about it…"
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <div className="composer-bottom">
                    <span>
                      <LockKeyhole size={12} />
                      {selectedCustomer
                        ? `Investigating ${selectedCustomer.name.split(" ")[0]}’s demo account`
                        : loading
                          ? "Connecting to demo accounts…"
                          : "Connect the demo database to begin"}
                    </span>
                    {busy ? (
                      <button
                        className="send-button stop-button"
                        type="button"
                        onClick={() => abortRef.current?.abort()}
                        aria-label="Stop investigation"
                      >
                        <Square size={15} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        className="send-button"
                        type="submit"
                        disabled={
                          !draft.trim() ||
                          !selectedCustomer ||
                          !!connectionError
                        }
                        aria-label="Send message"
                      >
                        <ArrowRight size={20} />
                      </button>
                    )}
                  </div>
                </form>
                <div className="composer-caption">
                  <span>Demo data. Real investigation.</span>
                  <span>
                    Enter to send <span className="keycap">↵</span>
                  </span>
                </div>
              </div>
            </section>
          </div>
          <footer className="page-footer">
            <span>BUILT FOR TRANSPARENCY, BY DESIGN.</span>
            <span>
              Next.js<span className="footer-dot">·</span>Native tool calling
              <span className="footer-dot">·</span>Supabase
            </span>
          </footer>
        </main>
      </div>
    </WorkspaceShell>
  );
}

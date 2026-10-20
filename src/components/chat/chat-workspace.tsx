'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  Github,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { z } from 'zod';
import { AppLinks } from '../ui/site-header';
import { ThemeToggle } from '../ui/theme-toggle';
import { customerSchema, type Customer } from '@/lib/db/schemas';
import { readAgentEvents } from '@/lib/agent/events';
import { GUARD_MODEL_LABEL } from '@/lib/security/injection';
import { MAX_MESSAGE_LENGTH } from '@/lib/security/limits';
import { scenarios } from '@/lib/demo/scenarios';
import { CustomerPicker } from './customer-picker';
import { ScenarioButtons } from './scenario-buttons';
import { MessageList, type ChatMessage } from './message-list';

export function ChatWorkspace() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setConnectionError('');
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Could not load demo customers.',
        );
      const parsed = z.object({ customers: z.array(customerSchema) }).parse(data);
      setCustomers(parsed.customers);
      setCustomerId((current) =>
        parsed.customers.some((customer) => customer.id === current)
          ? current
          : parsed.customers.find((customer) => customer.id === scenarios[0].customerId)?.id ||
            parsed.customers[0]?.id ||
            '',
      );
      if (!parsed.customers.length)
        setConnectionError(
          'The database is connected but has no demo customers. Run the seed script to add the sample accounts.',
        );
    } catch (cause) {
      setConnectionError(
        cause instanceof Error ? cause.message : 'Could not connect to the demo database.',
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
    bottomRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages]);

  function reset(customer = customerId) {
    if (busy) return;
    setCustomerId(customer);
    setMessages([]);
    setDraft('');
    setError('');
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
      { role: 'user' as const, content: text },
    ].slice(-19);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      calls: [],
      step: 0,
    };
    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      calls: [],
      step: 0,
    };
    setMessages((current) => [...current, userMessage, reply]);
    setDraft('');
    setError('');
    setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    const updateReply = (update: (message: ChatMessage) => ChatMessage) =>
      setMessages((current) =>
        current.map((message) => (message.id === reply.id ? update(message) : message)),
      );
    let terminalEvent = false;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, messages: history }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          typeof data.error === 'string' ? data.error : 'The investigation could not start.',
        );
      }
      if (!response.body) throw new Error('The response stream is unavailable. Please try again.');
      for await (const event of readAgentEvents(response.body)) {
        if (event.type === 'run_started' && event.model === GUARD_MODEL_LABEL)
          updateReply((message) => ({ ...message, guarded: true }));
        if (event.type === 'text_delta')
          updateReply((message) => ({ ...message, content: message.content + event.text }));
        if (event.type === 'step_started')
          updateReply((message) => ({ ...message, step: event.step }));
        if (event.type === 'tool_started')
          updateReply((message) => ({
            ...message,
            calls: [
              ...message.calls,
              { callId: event.callId, name: event.name, input: event.input, status: 'running' },
            ],
          }));
        if (event.type === 'tool_finished')
          updateReply((message) => ({
            ...message,
            calls: message.calls.map((call) =>
              call.callId === event.callId
                ? {
                    ...call,
                    result: event.result,
                    durationMs: event.durationMs,
                    status: event.failed ? 'failed' : 'done',
                  }
                : call,
            ),
          }));
        if (event.type === 'error') {
          terminalEvent = true;
          throw new Error(event.message);
        }
        if (event.type === 'done') terminalEvent = true;
      }
      if (!terminalEvent)
        throw new Error(
          'The connection ended before the investigation finished. Please try again.',
        );
    } catch (cause) {
      const message = abort.signal.aborted
        ? 'Investigation stopped. Check the approval queue for requests already created. No refund executes without human approval.'
        : cause instanceof Error
          ? cause.message
          : 'Something went wrong. Please try again.';
      setError(message);
      updateReply((reply) => ({
        ...reply,
        content: reply.content || message,
        failed: true,
        calls: reply.calls.map((call) =>
          call.status === 'running'
            ? { ...call, status: 'failed', result: { error: 'Investigation interrupted.' } }
            : call,
        ),
      }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Resolve home">
          <span className="brand-mark">
            <Sparkles size={22} strokeWidth={1.7} />
          </span>
          <span>
            resolve<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">PAYMENT DISPUTE WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace">
          <span className="nav-active">
            <MessageSquareText size={17} />
            Investigation
            <span className="nav-dot" />
          </span>
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-explainer">
          <span className="eyebrow">SMALL TOOLS. CLEAR ANSWERS.</span>
          <h2>
            A second look
            <br />
            at your payments.
          </h2>
          <p>
            An AI agent that follows the evidence, explains the details, and keeps you in control.
          </p>
        </div>
        <div className="workflow">
          <span>
            <i>01</i> Describe the problem
          </span>
          <span>
            <i>02</i> Watch the investigation
          </span>
          <span>
            <i>03</i> Understand your options
          </span>
        </div>
        <div className="sidebar-bottom">
          <div className="sandbox-note">
            <ShieldCheck size={19} />
            <div>
              <strong>A safe place to explore</strong>
              <p>
                Fictional customers and payments.
                <br />
                No real money. Ever.
              </p>
            </div>
          </div>
          <a
            className="github-link"
            href="https://github.com/NishithVadlamudi/AI-Payment-Dispute-Agent"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={16} /> View project on GitHub
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace<span>/</span>
            <strong>Investigation</strong>
          </div>
          <div className="topbar-actions">
            <AppLinks active="demo" />
            <span className="demo-badge">
              <span />
              DEMO ENVIRONMENT
            </span>
            <ThemeToggle />
            <button
              className="icon-button help-button"
              onClick={() => setHelp(!help)}
              aria-label="About this demo"
              aria-expanded={help}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <main id="main-content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">AI PAYMENT DISPUTE AGENT</span>
              <h1>Every payment has a story.</h1>
              <p>Let’s find out what happened, and what you can do next.</p>
            </div>
            <span className="phase-badge">
              <span />
              MOCK PAYMENTS · HUMAN CONTROL
            </span>
          </section>
          {help && (
            <div className="help-panel">
              <strong>Under the surface</strong>
              <p>
                Next.js serves a streamed AI agent with native tool calling. Four investigation tools
                inspect mock payments stored in Supabase. A fifth tool can request a refund; only
                the human approval queue can execute it. Every tool call and decision is audited.
                Conversations are held in this tab and clear when you switch customers or refresh.
              </p>
              <button
                onClick={() => setHelp(false)}
                className="icon-button"
                aria-label="Close demo information"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {connectionError && (
            <div className="connection-notice" role="alert">
              <div>
                <strong>The demo database needs attention</strong>
                <p>{connectionError}</p>
              </div>
              <button onClick={loadCustomers} disabled={loading}>
                {loading ? <LoaderCircle size={15} className="spin" /> : 'Retry connection'}
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
                disabled={busy || loading || !customers.length || !!connectionError}
              />
              <div className="how-it-works">
                <span className="how-icon">
                  <LockKeyhole size={17} />
                </span>
                <h3>Investigation, with guardrails.</h3>
                <p>
                  The agent investigates and proposes refunds. A human must approve before any
                  mock refund executes.
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
            <section className="chat-panel" aria-label="Payment investigation chat">
              <div className="chat-header">
                <div className="agent-profile">
                  <span className="agent-avatar">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <strong>Resolve assistant</strong>
                    <span>
                      {busy ? 'Investigating payment records' : 'Your payment investigator'}
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
              <MessageList messages={messages} busy={busy} bottomRef={bottomRef} />
              <div className="composer-area">
                {error && (
                  <div className="chat-error" role="alert">
                    <span>{error}</span>
                    <button
                      className="icon-button"
                      onClick={() => setError('')}
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
                        event.key === 'Enter' &&
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
                        ? `Investigating ${selectedCustomer.name.split(' ')[0]}’s demo account`
                        : loading
                          ? 'Connecting to demo accounts…'
                          : 'Connect the demo database to begin'}
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
                        disabled={!draft.trim() || !selectedCustomer || !!connectionError}
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
    </div>
  );
}

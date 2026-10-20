import { ArrowDownLeft, Sparkles, UserRound } from "lucide-react";
import type { RefObject } from "react";
import Markdown from "react-markdown";
import { RefundReviewLink } from "./refund-review-link";
import { ToolActivityPanel } from "./tool-activity";
import type { ToolActivity } from "./tool-activity";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  calls: ToolActivity[];
  step: number;
  failed?: boolean;
  guarded?: boolean;
};

export function MessageList({
  messages,
  busy,
  bottomRef,
}: {
  messages: ChatMessage[];
  busy: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className={`message-list ${!messages.length ? "is-empty" : ""}`}
      aria-label="Conversation"
      aria-busy={busy}
    >
      {!messages.length ? (
        <div className="chat-empty">
          <div className="empty-art" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <div className="empty-symbol">
              <Sparkles size={30} strokeWidth={1.4} />
            </div>
            <span className="orbit-dot" />
          </div>
          <span className="eyebrow">LET’S GET TO THE SOURCE</span>
          <h2>
            What happened with
            <br />
            your payment?
          </h2>
          <p>
            Describe the problem in your own words.
            <br />
            I’ll look at the records and explain what I find.
          </p>
          <span className="empty-caption">
            <ArrowDownLeft size={14} aria-hidden="true" />
            Try a scenario or ask a question below
          </span>
        </div>
      ) : (
        messages.map((message, index) => (
          <article key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === "user" ? (
                <UserRound size={17} aria-hidden="true" />
              ) : (
                <Sparkles size={17} aria-hidden="true" />
              )}
            </div>
            <div className="message-body">
              <div className="message-label">
                {message.role === "user"
                  ? "You"
                  : message.guarded
                    ? "Safety guard"
                    : "Resolve"}
                {message.role === "assistant" && (
                  <span>{message.guarded ? "SYSTEM GUARD" : "AI AGENT"}</span>
                )}
              </div>
              {message.content ? (
                <div className="message-text">
                  {message.role === "assistant" ? (
                    <Markdown>{message.content}</Markdown>
                  ) : (
                    message.content
                  )}
                </div>
              ) : (
                <div className="thinking">
                  <span />
                  <span />
                  <span />
                  <span className="sr-only">Investigating your payment</span>
                </div>
              )}
              {message.guarded && (
                <p className="activity-description">
                  Blocked before model invocation. No tools ran.
                </p>
              )}
              {message.role === "assistant" && !message.guarded && (
                <ToolActivityPanel
                  calls={message.calls}
                  step={message.step}
                  busy={busy && index === messages.length - 1}
                />
              )}
              {message.role === "assistant" && !message.guarded && (
                <RefundReviewLink calls={message.calls} />
              )}
              {message.failed && (
                <p className="message-failed">
                  This investigation is incomplete. You can send your question
                  again to retry.
                </p>
              )}
            </div>
          </article>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

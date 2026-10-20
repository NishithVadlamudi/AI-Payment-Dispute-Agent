export const GUARD_MODEL_LABEL = 'Safety guard · no model call';

export const injectionRefusal =
  'Safety guard: I can’t follow instructions to bypass my rules or issue refunds on demand. No refund was requested or issued. Start a new chat to investigate a genuine payment problem within the selected customer’s account; any eligible refund still needs human approval.';

// A deterministic guard for explicit override attempts, including the demo.
// This is not a complete injection classifier; scoped tools, SQL rules and
// human approval remain mandatory even when an attack is not recognized here.
export function hasUnsafeOverride(messages: { role: string; content: string }[]) {
  return messages.some(({ content }) => (
    /\b(ignore|disregard|override|bypass)\b[\s\S]{0,100}\b(instructions?|rules?|polic(?:y|ies)|approvals?|system)\b/i.test(content) ||
    /\b(skip|without|bypass)\b[\s\S]{0,40}\b(human|manual)\s+approval\b/i.test(content)
  ));
}

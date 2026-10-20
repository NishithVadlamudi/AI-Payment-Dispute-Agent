import { Check, ChevronDown, LoaderCircle, Terminal, TriangleAlert } from 'lucide-react';

export type ToolActivity = {
  callId: string;
  name: string;
  input: unknown;
  result?: unknown;
  status: 'running' | 'done' | 'failed';
  durationMs?: number;
};

export function ToolActivityPanel({
  calls,
  busy,
  step,
}: {
  calls: ToolActivity[];
  busy: boolean;
  step: number;
}) {
  return (
    <details className="activity-panel" open={busy || undefined}>
      <summary>
        <span className="activity-heading">
          <Terminal size={16} aria-hidden="true" />
          Agent reasoning<span className="subtle-tag">TOOL ACTIVITY</span>
        </span>
        <span className="activity-count">
          {busy ? `Step ${step || 1} / 8` : `${calls.length} tool calls`}
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </summary>
      <div className="activity-content">
        <p className="activity-description">
          The evidence behind the answer: tool inputs and results, rather than the model’s private
          reasoning.
        </p>
        {!calls.length && (
          <p className="activity-empty">
            Tool activity will appear here when an investigation begins.
          </p>
        )}
        {calls.map((call) => (
          <details key={call.callId} className={`tool-call ${call.status}`}>
            <summary>
              <span>
                {call.status === 'running' ? (
                  <LoaderCircle size={15} className="spin" aria-label="Running" />
                ) : call.status === 'failed' ? (
                  <TriangleAlert size={15} aria-label="Failed" />
                ) : (
                  <Check size={15} aria-label="Complete" />
                )}
                <code>{call.name}</code>
              </span>
              <span className="tool-timing">
                {call.durationMs === undefined ? 'Running…' : `${call.durationMs} ms`}
                <ChevronDown size={13} aria-hidden="true" />
              </span>
            </summary>
            <div className="tool-payload">
              <h4>INPUT</h4>
              <pre>{JSON.stringify(call.input, null, 2)}</pre>
              <h4>RESULT</h4>
              <pre>
                {call.result === undefined
                  ? 'Waiting for the tool…'
                  : JSON.stringify(call.result, null, 2)}
              </pre>
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}

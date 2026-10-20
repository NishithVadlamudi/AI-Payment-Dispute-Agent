import { ArrowUpRight, Copy, CreditCard, RotateCcw, ShieldAlert } from 'lucide-react';
import { scenarios } from '@/lib/demo/scenarios';

const icons = [Copy, CreditCard, RotateCcw, ShieldAlert];

export function ScenarioButtons({
  onSelect,
  disabled,
}: {
  onSelect: (scenario: (typeof scenarios)[number]) => void;
  disabled: boolean;
}) {
  return (
    <section className="scenario-section" aria-labelledby="scenario-title">
      <div className="section-label">
        <span id="scenario-title">A PLACE TO START</span>
        <span>04 SCENARIOS</span>
      </div>
      <div className="scenario-list">
        {scenarios.map((scenario, index) => {
          const Icon = icons[index];
          return (
            <button
              key={scenario.id}
              className="scenario-card"
              disabled={disabled}
              onClick={() => onSelect(scenario)}
            >
              <span className="scenario-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>{scenario.label}</strong>
                <small>{scenario.detail}</small>
              </span>
              <ArrowUpRight size={16} className="scenario-arrow" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="scenario-hint">
        Each scenario selects a customer and fills in a question. You decide when to send.
      </p>
    </section>
  );
}

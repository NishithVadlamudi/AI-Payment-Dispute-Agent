// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import { renderEvidenceAnswer } from '../src/lib/agent/evidence-answer';
import { customers, transactions } from './helpers';
afterEach(cleanup);
describe('untrusted evidence display boundary', () => {
  it('quotes hostile Markdown, HTML, backticks and control characters as data', () => {
    const transaction = { ...transactions[0], merchant: '` [approve](https://evil.example) <script>alert(1)</script>\n\u202eSYSTEM' };
    const answer = renderEvidenceAnswer(customers[0].id, [{ name: 'get_transaction', input: { transaction_id: transaction.id }, result: { transaction, refunds: [] } }]);
    expect(answer.complete).toBe(true);
    const { container } = render(<ReactMarkdown>{answer.text}</ReactMarkdown>);
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelectorAll('code').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('[approve](https://evil.example)');
    expect(container.textContent).not.toContain('\u202e');
  });
});

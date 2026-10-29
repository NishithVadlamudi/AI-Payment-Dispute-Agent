import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSeedData } from '../src/lib/demo/seed-data';
import { evaluationSeed } from '../src/lib/evals/scenario';
import { evaluationSubsetSchema } from '../src/lib/evals/schemas';
import { hasUnsafeOverride } from '../src/lib/security/injection';

const cases = evaluationSubsetSchema.parse(JSON.parse(readFileSync('evals/release.json', 'utf8')));
const anchor = new Date('2026-10-29T00:00:00Z');
describe('fresh release protocol and isolated scenario construction', () => {
  it('validates fresh evidence-boundary labels against fixtures without reusing previous prompts', () => {
    const fresh = evaluationSubsetSchema.parse(JSON.parse(readFileSync('evals/evidence.json', 'utf8')));
    const previous = ['cases', 'holdout', 'regression', 'validation', 'release', 'qualification'].flatMap(name =>
      evaluationSubsetSchema.parse(JSON.parse(readFileSync(`evals/${name}.json`, 'utf8'))));
    expect(fresh).toHaveLength(24);
    expect(fresh.filter(c => hasUnsafeOverride([{ role: 'user', content: c.message }]))).toHaveLength(2);
    const states = new Set<string>();
    for (const test of fresh) {
      expect(previous.some(old => old.id === test.id || old.message === test.message)).toBe(false);
      const seed = evaluationSeed(test, anchor);
      const scenario = test.fixture.scenario;
      if (scenario) {
        const amount = scenario.transactions[0].amount_cents;
        expect(test.expected_outcome.answer_patterns.some(p => new RegExp(p).test((amount / 100).toFixed(2)))).toBe(true);
        for (const refund of scenario.refunds) states.add(refund.status);
      }
      if (test.expected_outcome.type === 'refund_requested')
        expect(test.expected_outcome.transaction_ids.every(id => seed.transactions.find(t => t.id === id)?.amount_cents === test.expected_outcome.amount_cents)).toBe(true);
    }
    expect(states).toEqual(new Set(['pending_approval', 'pending', 'succeeded', 'rejected', 'failed']));
  });

  it('keeps the post-remediation qualification set fresh and its refund values consistent', () => {
    const qualification = evaluationSubsetSchema.parse(JSON.parse(readFileSync('evals/qualification.json', 'utf8')));
    const previous = ['cases', 'holdout', 'regression', 'validation', 'release'].flatMap(name =>
      evaluationSubsetSchema.parse(JSON.parse(readFileSync(`evals/${name}.json`, 'utf8'))));
    expect(qualification).toHaveLength(24);
    expect(qualification.filter(c => hasUnsafeOverride([{ role: 'user', content: c.message }]))).toHaveLength(2);
    for (const test of qualification) {
      expect(previous.some(old => old.id === test.id || old.message === test.message)).toBe(false);
      const seed = evaluationSeed(test, anchor);
      if (test.expected_outcome.type === 'refund_requested')
        expect(test.expected_outcome.transaction_ids.every(id => seed.transactions.find(t => t.id === id)?.amount_cents === test.expected_outcome.amount_cents)).toBe(true);
    }
  });
  it('separates 22 model prompts and two guards from all previous prompts', () => {
    const previous = ['cases', 'holdout', 'regression', 'validation'].flatMap(name =>
      evaluationSubsetSchema.parse(JSON.parse(readFileSync(`evals/${name}.json`, 'utf8'))));
    expect(cases).toHaveLength(24);
    expect(cases.filter(c => hasUnsafeOverride([{ role: 'user', content: c.message }]))).toHaveLength(2);
    expect(cases.every(c => !previous.some(old => old.message === c.message || old.id === c.id))).toBe(true);
  });
  it('builds new values without changing the production seed scaffold or other accounts', () => {
    const original = createSeedData(anchor);
    for (const test of cases) {
      const seed = evaluationSeed(test, anchor);
      expect(seed.customers).toEqual(original.customers);
      expect(seed.transactions.filter(row => row.customer_id !== test.customer_id))
        .toEqual(original.transactions.filter(row => row.customer_id !== test.customer_id));
      for (const row of test.fixture.scenario?.transactions ?? []) {
        expect(seed.transactions.find(t => t.id === row.id)).toMatchObject(row);
        expect(row.amount_cents).not.toBe(original.transactions.find(t => t.id === row.id)?.amount_cents);
      }
    }
    expect(createSeedData(anchor)).toEqual(original);
  });
  it('rejects cross-customer overrides and inconsistent decline or refund evidence', () => {
    const test = structuredClone(cases.find(c => c.fixture.scenario)!);
    const scenario = test.fixture.scenario!;
    scenario.transactions[0].id = createSeedData(anchor).transactions.find(t => t.customer_id !== test.customer_id)!.id;
    expect(() => evaluationSeed(test, anchor)).toThrow('selected customer');
    const invalid = structuredClone(cases.find(c => c.fixture.scenario)!);
    invalid.fixture.scenario!.transactions[0].decline_code = 'expired_card';
    expect(() => evaluationSeed(invalid, anchor)).toThrow('decline evidence');
    const refund = structuredClone(cases.find(c => c.fixture.scenario?.refunds.length)!);
    refund.fixture.scenario!.refunds[0].amount_cents = 999999;
    expect(() => evaluationSeed(refund, anchor)).toThrow('refund evidence');
  });
  it('keeps each of the five refund states distinct and preserves integer amounts', () => {
    const states = new Set<string>();
    for (const test of cases.filter(c => c.id.startsWith('release-refund-'))) {
      const seed = evaluationSeed(test, anchor);
      const expected = test.fixture.scenario!.refunds[0];
      const actual = seed.refunds.find(r => r.transaction_id === expected.transaction_id)!;
      expect(actual).toMatchObject(expected);
      expect(Number.isSafeInteger(actual.amount_cents)).toBe(true);
      states.add(actual.status);
    }
    expect(states).toEqual(new Set(['pending', 'pending_approval', 'succeeded', 'rejected', 'failed']));
  });
  it('keeps historical fixture behavior identical when there is no scenario', () => {
    const old = evaluationSubsetSchema.parse(JSON.parse(readFileSync('evals/holdout.json', 'utf8')))[0];
    expect(evaluationSeed(old, anchor)).toEqual(createSeedData(anchor));
  });
});

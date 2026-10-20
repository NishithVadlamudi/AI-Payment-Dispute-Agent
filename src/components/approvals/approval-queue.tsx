'use client';

import Link from 'next/link';
import { SiteHeader } from '../ui/site-header';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { approvalSchema, type Approval } from '@/lib/db/refund-types';
import { refundSchema } from '@/lib/db/schemas';

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}

export function ApprovalQueue() {
  const [refunds, setRefunds] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/refunds', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load the approval queue.');
      setRefunds(z.array(approvalSchema).parse(data.refunds));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the approval queue.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy(id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/refunds/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The decision could not be confirmed. Refresh before retrying.');
      const refund = refundSchema.parse(data.refund);
      setRefunds((current) => current.filter((row) => row.id !== id));
      setNotice(refund.status === 'succeeded'
        ? `Mock refund ${refund.id} completed for ${money(refund.amount_cents, refund.currency)}. No real money moved.`
        : `Refund ${refund.id} rejected. No refund was issued.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The decision could not be confirmed. Refresh before retrying.');
    } finally { setBusy(null); }
  }

  return (
    <>
    <SiteHeader active="approvals" />
    <main id="main-content" className="approvals-page">

      <section className="page-heading">
        <div><span className="eyebrow">HUMAN REVIEW</span><h1>Refund approvals</h1>
          <p>The agent proposes. You decide.</p></div>
        <button className="review-button" onClick={load} disabled={loading || !!busy}>Refresh queue</button>
      </section>
      <p className="review-intro">Review the transaction and the agent’s evidence before approving. Approval immediately completes a mock refund once. Rejection releases the reserved balance. These controls represent a demo reviewer; no real payments or banks are connected.</p>
      {notice && <p className="review-notice" role="status">{notice}</p>}
      {error && <p className="chat-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading approval queue…</p> : !error && !refunds.length ? (
        <section className="approval-card"><h2>No refunds awaiting review</h2>
          <p>Try the Double charge scenario in the investigation, then return here to review the agent’s request.</p>
          <Link href="/demo">Start an investigation →</Link></section>
      ) : null}
      {!loading && refunds.map((refund) => (
        <article className="approval-card" key={refund.id}>
          <div className="approval-card-heading"><div><span className="eyebrow">PENDING APPROVAL</span>
            <h2>{money(refund.amount_cents, refund.currency)} · {refund.transaction.merchant}</h2>
            <p>{refund.customer.name} · {refund.customer.email}</p></div>
            <span className="approval-time">{new Date(refund.created_at).toLocaleString()}</span></div>
          <dl className="approval-details">
            <div><dt>Original payment</dt><dd>{money(refund.transaction.amount_cents, refund.transaction.currency)} · {refund.transaction.status}</dd></div>
            <div><dt>Transaction</dt><dd>{refund.transaction_id}</dd></div>
            <div><dt>Payment date</dt><dd>{new Date(refund.transaction.created_at).toLocaleString()}</dd></div>
            <div><dt>Refund request</dt><dd>{refund.id}</dd></div>
          </dl>
          <div className="review-reason"><h3>Agent’s explanation</h3><p>{refund.reason}</p></div>
          <div className="approval-actions">
            <button className="review-button review-approve" disabled={!!busy} onClick={() => decide(refund.id, 'approve')}>{busy === refund.id ? 'Saving decision…' : 'Approve mock refund'}</button>
            <button className="review-button" disabled={!!busy} onClick={() => decide(refund.id, 'reject')}>Reject</button>
          </div>
        </article>
      ))}
      <p className="review-intro">Requests reserve the available balance. The database rechecks eligibility during approval and records each decision in the audit log. Showing up to 100 oldest requests. Refresh to see changes from other tabs.</p>
    </main>
    </>
  );
}

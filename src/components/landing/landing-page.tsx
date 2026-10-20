import Link from 'next/link';
import { ArrowRight, Check, CheckCheck, Fingerprint, GitBranch, LockKeyhole, Search, ShieldCheck, Terminal } from 'lucide-react';
import { SiteHeader } from '../ui/site-header';

export function LandingPage() {
  return <div className="landing-shell">
    <SiteHeader active="home" />
    <main id="main-content" className="landing-main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-copy">
          <span className="eyebrow landing-kicker"><span /> A PAYMENTS + AI ENGINEERING PROJECT</span>
          <h1 id="landing-title">Payment disputes,<br /><em>with evidence.</em></h1>
          <p className="hero-description">Describe a payment problem in plain English, and an AI agent investigates fictional transactions with tools. See the evidence behind its answer and review any refund it proposes. Only a human can approve a mock refund; no real banks or money are connected.</p>
          <div className="hero-actions"><Link className="primary-link" href="/payments">Try it <ArrowRight size={17} aria-hidden="true" /></Link><Link className="secondary-link" href="/under-the-hood">Explore the engineering <ArrowRight size={15} aria-hidden="true" /></Link></div>
          <p className="hero-reassurance"><ShieldCheck size={15} aria-hidden="true" /> Fictional customers. Mock payments. Human control.</p>
          <div className="technology-strip" aria-label="Technology stack"><span>Next.js</span><span>TypeScript</span><span>Postgres</span><span>Native AI tools</span></div>
        </div>
        <div className="workflow-preview" aria-label="Illustrative double-charge investigation">
          <div className="preview-top"><span><span className="preview-dot" /> CASE STUDY / 001</span><span>ILLUSTRATIVE WORKFLOW</span></div>
          <div className="preview-question"><span className="preview-avatar">MC</span><div><span>MAYA CHEN · DEMO CUSTOMER</span><p>“I was charged twice for one purchase.”</p></div></div>
          <div className="preview-investigation"><div className="preview-caption"><Search size={15} aria-hidden="true" /><span>Follow the evidence</span><CheckCheck size={16} aria-hidden="true" /></div>
            <div className="preview-payment"><span><strong>Northstar Electronics</strong><small>Successful charge · 13:30</small></span><strong>$84.99</strong></div>
            <div className="preview-payment"><span><strong>Northstar Electronics</strong><small>Successful charge · 13:32</small></span><strong>$84.99</strong></div>
            <p className="preview-finding">Matching charges suggest a duplicate. Check refund history before proposing a fix.</p>
          </div>
          <div className="preview-tool"><Terminal size={14} aria-hidden="true" /><code>request_refund</code><span><Check size={13} aria-hidden="true" /> Request only</span></div>
          <div className="preview-review"><div><span className="eyebrow">NEXT STEP</span><strong>A human decides.</strong><small>$84.99 mock refund proposed</small></div><span className="review-pill"><LockKeyhole size={13} aria-hidden="true" /> Awaiting approval</span></div>
          <div className="preview-bottom"><Fingerprint size={14} aria-hidden="true" /><span>One execution per approved refund. Every action recorded.</span></div>
        </div>
      </section>
      <section className="landing-workflow" aria-labelledby="workflow-title">
        <div className="landing-section-heading"><div><span className="eyebrow">A SMALL WORKFLOW. REAL ENGINEERING DECISIONS.</span><h2 id="workflow-title">From a question to a reviewable action.</h2></div><span className="section-index">01 — 03</span></div>
        <div className="workflow-cards">
          <Link href="/payments" className="workflow-card"><span className="feature-number">01 / INVESTIGATE</span><Search size={23} aria-hidden="true" /><h3>Start with a question.</h3><p>Try a double charge, a failed payment, or a missing refund. Inspect the exact tools and records behind the response.</p><span className="feature-link">Open the investigation <ArrowRight size={15} aria-hidden="true" /></span></Link>
          <Link href="/approvals" className="workflow-card"><span className="feature-number">02 / APPROVE</span><ShieldCheck size={23} aria-hidden="true" /><h3>Keep a person in control.</h3><p>The agent can propose a refund. Database rules enforce the balance, and repeated approvals produce one mock execution.</p><span className="feature-link">See the approval queue <ArrowRight size={15} aria-hidden="true" /></span></Link>
          <Link href="/under-the-hood" className="workflow-card"><span className="feature-number">03 / INSPECT</span><GitBranch size={23} aria-hidden="true" /><h3>Make behavior visible.</h3><p>Review tool evidence, tokens, latency, and estimated cost. Read the measured results and limitations of 40 evaluation cases.</p><span className="feature-link">Look under the hood <ArrowRight size={15} aria-hidden="true" /></span></Link>
        </div>
      </section>
      <section className="landing-principles" aria-label="Engineering boundaries"><div><span className="eyebrow">BUILT TO BE INSPECTED</span><h2>Useful automation.<br />Explicit boundaries.</h2></div><ul><li><Check size={16} aria-hidden="true" /> Customer scope enforced on the server</li><li><Check size={16} aria-hidden="true" /> Integer cents and database idempotency</li><li><Check size={16} aria-hidden="true" /> Human approval before mock execution</li><li><Check size={16} aria-hidden="true" /> Shared request and daily budget limits</li></ul><Link href="/payments" className="primary-link">Try the demo <ArrowRight size={16} aria-hidden="true" /></Link></section>
      <footer className="landing-footer"><span>RESOLVE / AI PAYMENT DISPUTE AGENT</span><span>A portfolio project by <a href="https://github.com/NishithVadlamudi" target="_blank" rel="noreferrer">NishithVadlamudi ↗</a></span></footer>
    </main>
  </div>;
}

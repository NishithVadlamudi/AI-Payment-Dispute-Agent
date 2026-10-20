import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';

export type PageSection = 'home' | 'demo' | 'approvals' | 'observability';
export function AppLinks({ active }: { active: PageSection }) {
  const links = [
    { id: 'demo', href: '/demo', label: 'Investigation' },
    { id: 'approvals', href: '/approvals', label: 'Approvals' },
    { id: 'observability', href: '/under-the-hood', label: 'Under the hood' },
  ];
  return <nav className="app-links" aria-label="Main navigation">{links.map((link) =>
    <Link href={link.href} key={link.id} aria-current={active === link.id ? 'page' : undefined}>{link.label}</Link>,
  )}</nav>;
}
export function SiteHeader({ active }: { active: PageSection }) {
  return <header className="site-header">
    <Link href="/" className="site-brand" aria-label="Resolve home"><span className="brand-mark"><Sparkles size={21} aria-hidden="true" /></span>resolve<span className="brand-dot">.</span></Link>
    <div className="site-header-actions"><AppLinks active={active} /><ThemeToggle />
      <a className="repo-link" href="https://github.com/NishithVadlamudi/AI-Payment-Dispute-Agent" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
  </header>;
}

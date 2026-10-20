"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  Activity,
  CreditCard,
  FileCheck2,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export type PageSection =
  "home" | "payments" | "demo" | "approvals" | "observability";
export const workspaceSections = [
  { id: "payments", href: "/payments", label: "Overview", icon: CreditCard },
  { id: "demo", href: "/demo", label: "Investigate", icon: Sparkles },
  { id: "approvals", href: "/approvals", label: "Approvals", icon: FileCheck2 },
  {
    id: "observability",
    href: "/under-the-hood",
    label: "Activity",
    icon: Activity,
  },
] as const;

export function ResolveBrand() {
  return (
    <Link href="/" className="site-brand" aria-label="Resolve home">
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path
          d="M5 23V5h9a6 6 0 0 1 0 12H7m6-4 10 10"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      resolve<span className="brand-dot">.</span>
    </Link>
  );
}
export function AppLinks({
  active,
  close,
}: {
  active: PageSection;
  close?: () => void;
}) {
  return (
    <nav className="app-links" aria-label="Main navigation">
      {workspaceSections.map(({ id, href, label }) => (
        <Link
          href={href}
          key={id}
          onClick={close}
          aria-current={active === id ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function SiteHeader({ active }: { active: PageSection }) {
  const menu = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <header className="site-header">
        <ResolveBrand />
        <div className="desktop-navigation">
          <AppLinks active={active} />
        </div>
        <div className="site-header-actions">
          <span className="workspace-demo-label">Mock payments</span>
          <ThemeToggle />
          <button
            ref={trigger}
            className="icon-button navigation-trigger"
            aria-label="Open navigation"
            onClick={() => menu.current?.showModal()}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      <dialog
        ref={menu}
        className="workspace-menu"
        aria-label="Workspace navigation"
        onClose={() => trigger.current?.focus()}
      >
        <div className="workspace-menu-heading">
          <ResolveBrand />
          <button
            className="icon-button"
            aria-label="Close navigation"
            onClick={() => menu.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <AppLinks active={active} close={() => menu.current?.close()} />
        <p>Fictional accounts. Human-approved refunds.</p>
        <details className="install-help">
          <summary>Add Resolve to your home screen</summary>
          <p>
            On iPhone or iPad, open this site in Safari, tap Share, then Add to
            Home Screen. On Android or desktop, use your browser’s Install app
            option when available. An internet connection is required; payment
            and agent data are not stored offline.
          </p>
        </details>
        <a
          href="https://github.com/NishithVadlamudi/AI-Payment-Dispute-Agent"
          target="_blank"
          rel="noreferrer"
        >
          View project source
        </a>
      </dialog>
    </>
  );
}

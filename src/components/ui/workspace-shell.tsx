import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader, workspaceSections, type PageSection } from "./site-header";

export function WorkspaceShell({
  active,
  children,
}: {
  active: PageSection;
  children: ReactNode;
}) {
  return (
    <div className="app-frame">
      <SiteHeader active={active} />
      <div className="workspace-body">
        <nav className="workspace-rail" aria-label="Workspace shortcuts">
          {workspaceSections.map(({ id, href, label, icon: Icon }) => (
            <Link
              href={href}
              key={id}
              aria-current={active === id ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              <Icon size={20} aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <div className="workspace-content">{children}</div>
      </div>
      <nav className="workspace-bottom-nav" aria-label="Mobile workspace">
        {workspaceSections.map(({ id, href, label, icon: Icon }) => (
          <Link
            href={href}
            key={id}
            aria-current={active === id ? "page" : undefined}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

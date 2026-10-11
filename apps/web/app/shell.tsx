import type { ReactNode } from "react";
import Link from "next/link";
import { FictionalBanner } from "@subsea/ui";

const DISABLED_NAV = ["Assets", "Map", "Integrations", "Rules", "Reports", "Administration"];

export function Shell({
  farm,
  openCases,
  initials,
  current,
  children,
}: {
  farm: string | null;
  openCases: number;
  initials: string;
  current: "overview" | "cases";
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <strong>Subsea Response OS</strong>
            <p>Engineering operations</p>
          </div>
        </div>
        <div className="environment">
          <span>OPERATING ENVIRONMENT</span>
          <strong>{farm ?? "Sign in"}</strong>
          <span>Offshore portfolio</span>
        </div>
        <nav aria-label="Primary">
          <Link href="/" aria-current={current === "overview" ? "page" : undefined}>
            Overview
          </Link>
          <Link href="/cases" aria-current={current === "cases" ? "page" : undefined}>
            {`Cases ${openCases}`}
          </Link>
          {DISABLED_NAV.map((item) => (
            <button key={item} type="button" disabled>
              {item}
            </button>
          ))}
        </nav>
        <div className="nav-note">
          <p>Decision support only</p>
          <p>No autonomous equipment control</p>
        </div>
      </aside>
      <div className="column">
        <header className="app-bar">
          <button type="button" className="secondary" disabled>
            {farm ?? "Sign in"}
          </button>
          <input
            className="search"
            type="search"
            placeholder="Search cases, assets, evidence"
            aria-label="Search cases, assets, evidence"
          />
          <span className="badge-demo">Advisory</span>
          <div className="avatar" aria-hidden="true">
            {initials}
          </div>
        </header>
        <div className="workspace">{children}</div>
        <footer className="shell-footer">
          <FictionalBanner />
          <p className="meta">Advisory only. Human approval required. All times UTC.</p>
        </footer>
      </div>
    </div>
  );
}

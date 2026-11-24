"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NAV_ITEMS, isActivePath } from "./nav";

// The frame every page sits in: the Postline name, the four pages, then the page itself.
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            Postline
          </Link>
          <nav aria-label="Main">
            <ul className="nav-list">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="nav-link"
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>
      <main className="content">{children}</main>
    </>
  );
}

// The four top-level pages, in the order they appear in the navigation.
export type NavItem = { href: string; label: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/daily", label: "Daily" },
  { href: "/week", label: "Week" },
  { href: "/performance", label: "Performance" },
  { href: "/settings", label: "Settings" },
];

// A nav item is active on its own page and on any page below it.
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

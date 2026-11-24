import Link from "next/link";

const LINKS = [
  { href: "/daily", title: "Daily", help: "Ideas, drafts and posts for today." },
  { href: "/week", title: "Week", help: "Plan the week's posts from one brief." },
  { href: "/settings", title: "Settings", help: "Features, keys and models." },
];

export default function Home() {
  return (
    <section>
      <h1 className="page-title">Welcome back</h1>
      <p className="muted">Draft, check and plan your posts in one place. Pick where to start.</p>
      <ul className="plain-list" style={{ marginTop: "1.5rem" }}>
        {LINKS.map((link) => (
          <li key={link.href} className="task-row" style={{ padding: "0.9rem 0" }}>
            <Link href={link.href} className="item-title" style={{ fontSize: "1.0625rem" }}>
              {link.title}
            </Link>
            <p className="caption" style={{ fontSize: "0.9375rem" }}>{link.help}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

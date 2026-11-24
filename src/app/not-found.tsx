import Link from "next/link";

// Shows for any page that is not built yet, such as /week and /performance. Those pages are
// owned by other builders, so this one file covers them until they land.
export default function NotFound() {
  return (
    <section>
      <h1 className="page-title">Coming soon</h1>
      <p className="muted">This page is not built yet. Pick another page to carry on.</p>
      <p>
        <Link href="/">Back to the start</Link>
      </p>
    </section>
  );
}

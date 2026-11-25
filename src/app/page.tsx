import Link from "next/link";

// Start page. Shows the app is running and links to the screens that exist today.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Postline</h1>
      <p className="text-neutral-600">
        Your personal content studio. Everything is stored on this computer.
      </p>
      <p className="text-sm text-neutral-500">
        Daily posts and Settings are ready. The other screens are not built yet.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/daily"
          className="inline-block rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-100"
        >
          Make daily posts
        </Link>
        <Link
          href="/settings"
          className="inline-block rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-100"
        >
          Open settings
        </Link>
      </div>
    </main>
  );
}

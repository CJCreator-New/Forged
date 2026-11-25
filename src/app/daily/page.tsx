import Link from "next/link";
import { trendMode } from "../../lib/features/flags";
import DailyFlow from "./daily-flow";

export default function DailyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-neutral-600 underline">
        Back to start
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Daily posts</h1>
      <p className="mt-1 text-neutral-600">
        Type a topic, pick an angle, and get one draft each for LinkedIn, Instagram and Facebook.
      </p>
      {!trendMode() && (
        <p className="mt-2 text-sm text-neutral-500">
          Trend mode is off. Angles come from your topic only, not from live trends.
        </p>
      )}
      <DailyFlow />
    </main>
  );
}

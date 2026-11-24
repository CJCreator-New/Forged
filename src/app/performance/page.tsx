import type { Metadata } from "next";
import PerformanceScreen from "../../components/performance/PerformanceScreen";

export const metadata: Metadata = {
  title: "Performance | Postline",
};

// The screen loads its numbers in the browser each time the page opens, so the ranking is never stale.
export default function PerformancePage() {
  return <PerformanceScreen />;
}

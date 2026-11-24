import type { Metadata } from "next";
import { DailyScreen } from "@/components/daily/DailyScreen";

export const metadata: Metadata = {
  title: "Daily",
};

export default function DailyPage() {
  return <DailyScreen />;
}

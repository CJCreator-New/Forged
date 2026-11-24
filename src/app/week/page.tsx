import type { Metadata } from "next";
import { WeekScreen } from "@/components/week/WeekScreen";

export const metadata: Metadata = {
  title: "Week",
};

export default function WeekPage() {
  return <WeekScreen />;
}

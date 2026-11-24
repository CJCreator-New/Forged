import type { Metadata } from "next";
import SettingsScreen from "../../components/settings/SettingsScreen";

export const metadata: Metadata = {
  title: "Settings | Postline",
};

// The screen loads its data in the browser each time the page opens, so the model list is never stale.
export default function SettingsPage() {
  return <SettingsScreen />;
}

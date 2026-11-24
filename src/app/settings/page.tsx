import { listSwitches } from "@/lib/features/switches";

// Read-only for now. Each feature switch with its default and its current value.
export default function SettingsPage() {
  const rows = listSwitches();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Feature switches from config/features.json. Read-only for now.
      </p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">Switch</th>
            <th className="py-2 pr-4">Default</th>
            <th className="py-2">Current</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b align-top">
              <td className="py-2 pr-4 font-mono">{row.key}</td>
              <td className="py-2 pr-4 font-mono break-all">{JSON.stringify(row.defaultValue)}</td>
              <td className="py-2 font-mono break-all">{JSON.stringify(row.currentValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

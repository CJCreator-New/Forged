import { requireLocal } from "@/lib/security/guard";
import { getBraveUsage } from "@/lib/pipeline/trend/trend";

// Monthly Brave search usage for the settings screen. Local requests only.
export async function GET(request: Request) {
  const denied = requireLocal(request);
  if (denied) return denied;
  return Response.json(getBraveUsage());
}

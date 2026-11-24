import { requireLocal } from "@/lib/security/guard";
import { getSearchUsage } from "@/lib/pipeline/trend/trend";

// Monthly free search credit usage (Tavily and Firecrawl) for the settings screen. Local requests only.
export async function GET(request: Request) {
  const denied = requireLocal(request);
  if (denied) return denied;
  return Response.json(getSearchUsage());
}

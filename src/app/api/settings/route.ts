import { gatewayStatus } from "../../../lib/gateway";
import { rejectIfNotLocal } from "../../../lib/local-guard";

// Key presence only (true or false). Never the key values.
export async function GET(request: Request): Promise<Response> {
  const denied = rejectIfNotLocal(request);
  if (denied) return denied;
  return Response.json({ keys: gatewayStatus() });
}

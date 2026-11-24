import { DailyError } from "./errors";

// Reads the JSON body of a request. A body that is not JSON is a bad request.
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new DailyError("bad_request", "The request body must be JSON.");
  }
}

// Local-only guard for every API route (ADR 0008).
// The dev server binds to 127.0.0.1, so only this machine can connect. This guard also rejects
// requests whose Host or Origin is not this app, which stops a web page in the user's own browser
// from calling the routes through DNS rebinding or cross-site requests.
// Every route handler calls requireLocal(request) first and returns the response if one is given.

const ALLOWED_HOSTS = new Set(["127.0.0.1:3000", "localhost:3000"]);
const ALLOWED_ORIGINS = new Set(["http://127.0.0.1:3000", "http://localhost:3000"]);

export function requireLocal(request: Request): Response | null {
  const host = request.headers.get("host");
  if (!host || !ALLOWED_HOSTS.has(host)) {
    return forbidden("Host is not this app.");
  }
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return forbidden("Origin is not this app.");
  }
  // A forwarded header means a proxy sits in front of the app. The app is local only, so refuse.
  if (request.headers.get("x-forwarded-for") !== null) {
    return forbidden("Forwarded requests are not accepted.");
  }
  return null;
}

function forbidden(message: string): Response {
  return Response.json({ error: { code: "forbidden", message } }, { status: 403 });
}

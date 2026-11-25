// Local-only guard for /api routes. The dev server binds to 127.0.0.1, this is a second lock.
const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d{1,5})?$/i;
// Next.js sets x-forwarded-for to the socket address on every request, so the header
// is allowed only when it holds a loopback address. A remote caller would show a LAN or internet address.
const LOOPBACK_ADDR = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

function fromLoopbackOnly(value: string | null): boolean {
  if (value === null) return true;
  const v = value.trim();
  return LOOPBACK_ADDR.test(v);
}

export function isLocalRequest(headers: Headers): boolean {
  if (!fromLoopbackOnly(headers.get("x-forwarded-for"))) return false;
  if (!fromLoopbackOnly(headers.get("x-real-ip"))) return false;
  const host = headers.get("host");
  return host !== null && LOCAL_HOST.test(host.trim());
}

/** Returns a 403 response when the request is not local, otherwise null. */
export function rejectIfNotLocal(request: Request): Response | null {
  if (isLocalRequest(request.headers)) return null;
  return Response.json({ error: "This app only answers requests from this computer." }, { status: 403 });
}

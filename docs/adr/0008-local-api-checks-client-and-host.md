# Local API routes accept only requests from this machine, checked by client address and Host header

Status: accepted

Every API route checks that the request comes from 127.0.0.1 and that its Host header is 127.0.0.1:3000 or localhost:3000. The Host check blocks DNS rebinding, where a web page open in the user's own browser tries to call the local app. We chose this stricter check over an address-only check because the app runs on a machine that browses the web, and a page could otherwise reach the routes that hold model calls and file writes.

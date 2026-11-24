# Model and search keys are read only on the server, from environment variables

Status: accepted

Keys live in `.env.local`, are read from `process.env` only in server code, and are never logged or sent to the browser. The gateway module is never imported by client components. The settings screen shows whether each key is set, never its value. We chose this over a key file in `content/` because a key in the user's data folder could be synced, shared, or exported with the posts.

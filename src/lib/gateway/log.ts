// The only logger for model and search calls. It records provider, model name, token count, and HTTP status.
// It never receives or prints key values (ADR 0004, doc 04 section 8).

export type CallLogEntry = {
  provider: string;
  model: string;
  tokens: number | null;
  status: number | null;
};

const sink: { write: (line: string) => void } = { write: (line) => process.stdout.write(line + "\n") };

// Tests replace the sink to check that no key value appears in output.
export function setLogSink(next: { write: (line: string) => void }): void {
  sink.write = next.write;
}

export function logCall(entry: CallLogEntry): void {
  const safe = {
    provider: String(entry.provider),
    model: String(entry.model),
    tokens: entry.tokens,
    status: entry.status,
  };
  sink.write(JSON.stringify({ event: "model_call", ...safe }));
}

export type LogSink = (message: string, ...rest: unknown[]) => void;

let sink: LogSink = (message, ...rest) => console.log(message, ...rest);

/** MCP over stdio must log to stderr: stdout carries the JSON-RPC stream. */
export function setLogSink(next: LogSink): void {
  sink = next;
}

export function log(message: string, ...rest: unknown[]): void {
  if (typeof process === "undefined" || !process.env.NO_COLOR) {
    message = message
      .replace(/✅/g, "SUCCESS:")
      .replace(/❌/g, "ERROR:")
      .replace(/ℹ️/g, "INFO:");
  }
  sink(message, ...rest);
}

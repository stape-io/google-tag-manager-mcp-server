// Helper function for logging that respects NO_COLOR
export function log(message: string, ...rest: unknown[]): void {
  // Remove emoji and color codes if NO_COLOR is set
  if (!process.env.NO_COLOR) {
    // Replace emoji and other special characters with plain text
    message = message
      .replace(/✅/g, "SUCCESS:")
      .replace(/❌/g, "ERROR:")
      .replace(/ℹ️/g, "INFO:")
      .replace(/\u2139\ufe0f/g, "INFO:");
  }
  console.error(message, ...rest);
}

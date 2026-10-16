import { OLD_HOST, SHUTDOWN_NOTICE } from "./hostNotice";

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Shown instead of a Google sign-in on the old host after the cutover. */
export const renderShutdownPage = (): string => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow" />
    <title>${OLD_HOST} was shut down</title>
    <style>
          body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              max-width: 640px;
              margin: 0 auto;
              padding: 40px 20px;
              color: #333;
          }

          h1 {
              color: #2c3e50;
              border-bottom: 3px solid #3498db;
              padding-bottom: 10px;
          }
    </style>
    </head>
    <body>
    <h1>${OLD_HOST} was shut down</h1>
    <p>${escapeHtml(SHUTDOWN_NOTICE)}</p>
    </body>
    </html>
  `;

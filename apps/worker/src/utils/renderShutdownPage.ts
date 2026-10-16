import { CUTOVER_TEXT, NEW_HOST, OLD_HOST } from "./hostNotice";
import { MOVE_STEPS_STYLE, renderMoveSteps } from "./renderMoveSteps";

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
          ${MOVE_STEPS_STYLE}

          /* Matches the approval dialog (workersOAuthUtils.ts). */
          body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                           Helvetica, Arial, sans-serif, "Apple Color Emoji",
                           "Segoe UI Emoji", "Segoe UI Symbol";
              line-height: 1.6;
              color: #333;
              background-color: #f9fafb;
              margin: 0;
              padding: 3rem 1rem;
          }

          main {
              max-width: 568px;
              margin: 0 auto;
              background-color: #fff;
              border-radius: 8px;
              box-shadow: 0 8px 36px 8px rgba(0, 0, 0, 0.1);
              padding: 2rem;
          }

          .badge {
              display: inline-block;
              margin: 0 0 16px;
              padding: 4px 12px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              color: #9a3412;
              background: #ffedd5;
          }

          h1 {
              margin: 0 0 8px;
              font-size: 28px;
              line-height: 1.25;
              overflow-wrap: anywhere;
          }

          .lead {
              margin: 0 0 32px;
              font-size: 18px;
              color: #555;
          }

          @media (max-width: 480px) {
              body {
                  padding: 12px;
              }

              main {
                  padding: 24px 16px;
              }

              h1 {
                  font-size: 24px;
              }
          }
    </style>
    </head>
    <body>
    <main>
      <p class="badge">Shut down on ${CUTOVER_TEXT}</p>
      <h1>${OLD_HOST} was shut down</h1>
      <p class="lead">This MCP server moved to <strong>${NEW_HOST}</strong>. Update your MCP client to keep using it.</p>
      ${renderMoveSteps()}
    </main>
    </body>
    </html>
  `;

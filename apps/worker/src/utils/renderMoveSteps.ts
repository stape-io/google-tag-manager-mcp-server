import { CUTOVER_TEXT, NEW_HOST, OLD_HOST } from "./hostNotice";

// HOW_TO_MOVE laid out for reading in a browser, shared by the shutdown page and
// the approval dialog. Everything interpolated here is a constant, so nothing
// needs escaping. The styles are scoped to `.move-steps` and carry their own
// colors, so they fit into either page; a page can override the variables.
export const MOVE_STEPS_STYLE = `
          .move-steps {
              --move-text: #333;
              --move-muted: #555;
              --move-border: #e5e7eb;
              --move-code-background: #f3f4f6;
              --move-accent: #0070f3;
              --move-accent-text: #fff;
              --move-old: #6b7280;
              --move-new: #047857;
              --move-new-background: #d1fae5;
              text-align: left;
              color: var(--move-text);
          }

          .move-steps ol {
              list-style: none;
              counter-reset: step;
              margin: 0;
              padding: 0;
          }

          .move-steps ol > li {
              counter-increment: step;
              position: relative;
              padding-left: 44px;
              margin-bottom: 28px;
          }

          .move-steps ol > li::before {
              content: counter(step);
              position: absolute;
              left: 0;
              top: 0;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: var(--move-accent);
              color: var(--move-accent-text);
              font-weight: 700;
              font-size: 15px;
              line-height: 28px;
              text-align: center;
          }

          .move-steps h2 {
              margin: 0 0 4px;
              font-size: 18px;
              font-weight: 600;
              line-height: 28px;
          }

          .move-steps li p {
              margin: 0 0 12px;
              color: var(--move-muted);
          }

          .move-steps code {
              font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
              font-size: 0.9em;
              overflow-wrap: anywhere;
          }

          .move-steps p code {
              padding: 1px 6px;
              border-radius: 4px;
              background: var(--move-code-background);
              color: var(--move-text);
              white-space: nowrap;
          }

          .move-steps .url-change {
              border: 1px solid var(--move-border);
              border-radius: 8px;
              padding: 8px 12px;
              margin-bottom: 8px;
              overflow-x: auto;
          }

          .move-steps .url-row {
              display: flex;
              align-items: baseline;
              gap: 12px;
              padding: 4px 0;
          }

          .move-steps .tag {
              flex: none;
              width: 40px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: var(--move-old);
          }

          .move-steps .tag-new {
              color: var(--move-new);
          }

          .move-steps .url-row code {
              white-space: nowrap;
          }

          .move-steps .old {
              color: var(--move-old);
              text-decoration: line-through;
          }

          .move-steps .new {
              padding: 1px 6px;
              border-radius: 4px;
              background: var(--move-new-background);
              color: var(--move-new);
              font-weight: 600;
              user-select: all;
          }

          .move-steps .note {
              margin: 0;
              padding: 12px 16px;
              border-left: 4px solid var(--move-border);
              background: var(--move-code-background);
              border-radius: 0 8px 8px 0;
              color: var(--move-muted);
          }

          @media (max-width: 480px) {
              .move-steps ol > li {
                  padding-left: 0;
              }

              .move-steps ol > li::before {
                  position: static;
                  display: inline-block;
                  margin-bottom: 8px;
              }

              .move-steps .url-row {
                  flex-direction: column;
                  gap: 0;
              }

              .move-steps .url-row code {
                  font-size: 13px;
              }
          }
`;

const urlChange = (path: string): string => `
            <div class="url-change">
              <div class="url-row">
                <span class="tag">Old</span>
                <code class="old">https://${OLD_HOST}${path}</code>
              </div>
              <div class="url-row">
                <span class="tag tag-new">New</span>
                <code class="new">https://${NEW_HOST}${path}</code>
              </div>
            </div>`;

/** The steps themselves; the page includes MOVE_STEPS_STYLE. */
export const renderMoveSteps = (): string => `
      <div class="move-steps">
        <ol>
          <li>
            <h2>Change the server URL</h2>
            <p>In your MCP client config, replace <code>${OLD_HOST}</code> with <code>${NEW_HOST}</code> and keep the path.</p>
            ${urlChange("/mcp")}
            ${urlChange("/sse")}
          </li>
          <li>
            <h2>Sign in with Google again</h2>
            <p>${NEW_HOST} has its own sign-in, so your client asks you to sign in when it reconnects.</p>
          </li>
        </ol>
        <p class="note">If your organization manages this connector, ask an admin to change its URL.</p>
      </div>`;

/**
 * HOST_NOTICE for the approval dialog on the old host, before the cutover:
 * a self-contained block with its own styles.
 */
export const renderHostNoticeHtml = (): string => `
      <style>
          ${MOVE_STEPS_STYLE}

          .host-notice {
              margin: 24px 0 0;
              padding: 24px;
              border: 1px solid #fed7aa;
              border-radius: 8px;
              background: #fff7ed;
              text-align: left;
          }

          .host-notice-title {
              margin: 0 0 4px;
              font-size: 18px;
              font-weight: 600;
              color: #9a3412;
          }

          .host-notice-lead {
              margin: 0 0 20px;
              color: #555;
          }

          .host-notice .move-steps {
              --move-code-background: #fff;
              --move-border: #fed7aa;
          }

          .host-notice .url-change {
              background: #fff;
          }

          @media (max-width: 480px) {
              .host-notice {
                  padding: 16px;
              }
          }
      </style>
      <div class="host-notice">
        <p class="host-notice-title">${OLD_HOST} stops working on ${CUTOVER_TEXT}</p>
        <p class="host-notice-lead">This MCP server is moving to <strong>${NEW_HOST}</strong>. Update your MCP client before then.</p>
        ${renderMoveSteps()}
      </div>`;

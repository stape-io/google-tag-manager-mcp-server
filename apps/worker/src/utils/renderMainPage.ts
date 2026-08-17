export const renderMainPage = () => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow" />
    <title>Stape MCP Server for Google Tag Manager</title>
    <style>
          html {
              display: flex;
              flex-direction: column;
              min-height: 100%;
          }
    
          body {
              display: flex;
              flex-direction: column;
              flex: 1 0 auto;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              color: #333;
          }
    
           main {
              flex: 1;
          }
    
          h1 {
              color: #2c3e50;
              border-bottom: 3px solid #3498db;
              padding-bottom: 10px;
          }
    
          h2 {
              color: #34495e;
              margin-top: 30px;
          }
    
          h3 {
              color: #7f8c8d;
          }
    
          ul {
              padding-left: 20px;
          }
    
          li {
              margin-bottom: 8px;
          }
    
          hr {
              border: none;
              height: 2px;
              background-color: #bdc3c7;
              margin: 30px 0;
          }
    
          code {
              background-color: #f4f4f4;
          }
    
          footer {
              display: flex;
              justify-content: center;
              column-gap: 24px;
              margin-top: 16px;
          }
    </style>
    </head>
    <body>
      <main>
        <h1>Stape MCP Server for Google Tag Manager</h1>
        
        <p>
        This is a server that supports remote MCP connections, with Google OAuth built-in and provides an interface to the
        Google Tag Manager API.
        </p>
        
        <h2>Prerequisites</h2>
        
        <ul>
        <li>Node.js (v18 or higher)</li>
        </ul>
        
        <h2>Access the remote MCP server from Claude Desktop</h2>
        
        <p>
        Open Claude Desktop and navigate to Settings -> Developer -> Edit Config. This opens the configuration file that
        controls which MCP servers Claude can access.
        </p>
        
        <p>
        Replace the content with the following configuration. Once you restart Claude Desktop, a browser window will open
        showing your OAuth login page. Complete the authentication flow to grant Claude access to your MCP server. After you
        grant access, the tools will become available for you to use.
        </p>
        <code>
          {
            "mcpServers": {
              "google-tag-manager-mcp-server": {
                "command": "npx",
                "args": [
                  "-y",
                  "mcp-remote",
                  "https://gtm-mcp.stape.ai/sse"
                ]
              }
            }
          }
        </code>
        
        <h3>Troubleshooting</h3>
        
        <p>
        <a href="https://github.com/geelen/mcp-remote#readme">mcp-remote</a> stores all the credential information inside
        ~/.mcp-auth (or wherever your MCP_REMOTE_CONFIG_DIR points to). If you're having persistent issues, try running:
        You can run rm -rf ~/.mcp-auth to clear any locally stored state and tokens.
        </p>
        
        <code>rm -rf ~/.mcp-auth</code>
        
        <p>Then restarting your MCP client.</p>
        
      </main>
      
      <footer>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </footer>
    </body>
    </html>
  `;
};

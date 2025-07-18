import { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { log } from "../../utils";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export class StreamableController {
  private transportsMap = new Map<string, StreamableHTTPServerTransport>();
  private server: McpServer;

  constructor(server: McpServer) {
    this.server = server;
    
    // Bind methods to ensure correct 'this' context
    this.postMcp = this.postMcp.bind(this);
    this.getMcp = this.getMcp.bind(this);
    this.deleteMcp = this.deleteMcp.bind(this);
  }

  // POST /mcp - handles initialization requests and message processing
  postMcp = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    let transport: StreamableHTTPServerTransport;

    // Handle existing session
    if (sessionId && this.transportsMap.has(sessionId)) {
      transport = this.transportsMap.get(sessionId)!;
    } 
    // Handle new session (initialization request)
    else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          this.transportsMap.set(sessionId, transport);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          this.transportsMap.delete(transport.sessionId);
        }
      };

      await this.server.connect(transport);
    } 
    // Invalid session or missing initialization
    else {
      res.status(400).json({ error: "invalid_session", message: "No valid session found. Please initialize first." });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  };

  // GET /mcp - handles GET requests for existing sessions
  getMcp = async (req: Request, res: Response) => {
    return this.handleSessionRequest(req, res);
  };

  // DELETE /mcp - handles session cleanup
  deleteMcp = async (req: Request, res: Response) => {
    return this.handleSessionRequest(req, res);
  };

  // Private helper method for GET and DELETE requests
  private async handleSessionRequest(req: Request, res: Response) {
    const sessionId = req.headers["mcp-session-id"] as string;
    
    if (!sessionId || !this.transportsMap.has(sessionId)) {
      res.status(400).json({ error: "invalid_session", message: "No valid session found. Please initialize first." });
      return;
    }

    const transport = this.transportsMap.get(sessionId)!;
    await transport.handleRequest(req, res);
  };
}

import { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { log } from "../../utils";

export class SseController {
  private transports: Map<string, SSEServerTransport> = new Map();

  // Handle GET /sse (SSE connection establishment)
  getSse = (req: Request, res: Response) => {
    const sessionId = Math.random().toString(36).substring(7);

    try {
      // Create new SSE transport using MCP SDK
      const transport = new SSEServerTransport("/messages", res);

      // Store transport
      this.transports.set(sessionId, transport);
      log(`SSE client connected: ${sessionId}`);

      // Handle client disconnect
      req.on("close", () => {
        this.transports.delete(sessionId);
        log(`SSE client disconnected: ${sessionId}`);
      });

      req.on("error", (error) => {
        log(`SSE client error: ${error.message}`);
        this.transports.delete(sessionId);
      });
    } catch (error) {
      log(`Error creating SSE transport: ${error}`);
      res.status(500).json({ error: "Failed to establish SSE connection" });
    }
  };

  // Handle POST /messages (send messages via SSE)
  postMessages = (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId query parameter required" });
      return;
    }

    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const message = req.body;

    try {
      // Send message via MCP SSE transport
      transport.handleMessage(message);

      res.status(200).json({ status: "sent" });
      log(`Message sent via SSE to session: ${sessionId}`);
    } catch (error) {
      log(`Error sending SSE message: ${error}`);
      res.status(500).json({ error: "Failed to send message" });
    }
  };
}

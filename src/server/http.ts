import express from 'express';
import { log } from '../utils';

/**
 * Server transport for HTTP: this communicates with MCP clients over HTTP.
 */
export class HttpServerTransport {
  private app: express.Application;
  private server: any;
  private port: number;
  private started: boolean = false;

  // Event handlers
  public onmessage?: (message: any) => void;
  public onerror?: (error: Error) => void;
  public onclose?: () => void;
  
  // Store pending requests for HTTP responses
  private pendingRequests: Map<string, express.Response> = new Map();

  constructor(port = process.env.PORT ? parseInt(process.env.PORT) : 3000) {
    this.port = port;
    this.app = express();
    
    // Configure Express
    this.app.use(express.json({ limit: '50mb' }));
    
    // Enable CORS for remote access
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).send({ status: 'ok', transports: ['http', 'sse'] });
    });
    
    // SSE clients storage
    this.clients = new Map();
  }

  private clients: Map<string, express.Response> = new Map();

  /**
   * Starts the HTTP server and begins listening for messages.
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error("HttpServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    }

    // Set up the MCP endpoint
    this.app.post('/mcp', async (req, res) => {
      try {
        const message = req.body;
        
        if (!this.onmessage) {
          throw new Error('No message handler registered');
        }
        
        // Store the response object to send reply later
        if (message.id) {
          this.pendingRequests.set(message.id.toString(), res);
        }
        
        // Process the message through the onmessage handler
        this.onmessage(message);
        
        // If no ID, send immediate response
        if (!message.id) {
          res.status(200).json({ status: 'ok' });
        }
      } catch (error) {
        log(`Error processing request: ${error}`);
        if (this.onerror && error instanceof Error) {
          this.onerror(error);
        }
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // SSE endpoint for establishing connection
    this.app.get('/sse', (req, res) => {
      const clientId = Math.random().toString(36).substring(7);
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // Store client connection
      this.clients.set(clientId, res);
      log(`SSE client connected: ${clientId}`);

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'connection', clientId })}\n\n`);

      // Handle client disconnect
      req.on('close', () => {
        this.clients.delete(clientId);
        log(`SSE client disconnected: ${clientId}`);
      });

      req.on('error', (error) => {
        log(`SSE client error: ${error.message}`);
        this.clients.delete(clientId);
      });
    });

    // POST endpoint for receiving messages from SSE clients
    this.app.post('/message', async (req, res) => {
      try {
        const message = req.body;
        
        if (!this.onmessage) {
          throw new Error('No message handler registered');
        }
        
        log(`Received SSE message: ${JSON.stringify(message)}`);
        
        // Store the message ID for response routing via SSE
        if (message.id) {
          // Mark this as an SSE request for response routing
          message._sseRequest = true;
        }
        
        // Process the message through the onmessage handler
        this.onmessage(message);
        
        // For SSE, acknowledge receipt but response will come via SSE stream
        res.status(200).json({ status: 'received' });
      } catch (error) {
        log(`Error processing SSE message: ${error}`);
        if (this.onerror && error instanceof Error) {
          this.onerror(error);
        }
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    // Start the server
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        log(`HTTP server listening on port ${this.port}`);
        this.started = true;
        resolve();
      });
    });
  }

  /**
   * Closes the HTTP server.
   */
  async close(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server.close((err: Error) => {
          if (err) {
            if (this.onerror) {
              this.onerror(err);
            }
            reject(err);
          } else {
            log('HTTP server closed');
            if (this.onclose) {
              this.onclose();
            }
            resolve();
          }
        });
      });
    }
  }

  /**
   * Sends a message to connected clients via HTTP response or SSE.
   */
  async send(message: any): Promise<void> {
    const messageStr = JSON.stringify(message);
    
    // Handle HTTP responses for requests with IDs
    if (message.id && this.pendingRequests.has(message.id.toString())) {
      const res = this.pendingRequests.get(message.id.toString())!;
      this.pendingRequests.delete(message.id.toString());
      
      try {
        res.status(200).json(message);
        log(`Sent HTTP response for request ID: ${message.id}`);
        return Promise.resolve();
      } catch (error) {
        log(`Error sending HTTP response: ${error}`);
      }
    }
    
    // Send to SSE clients if any are connected
    if (this.clients.size > 0) {
      const disconnectedClients: string[] = [];
      for (const [clientId, res] of this.clients) {
        try {
          res.write(`data: ${messageStr}\n\n`);
        } catch (error) {
          log(`Error sending to SSE client ${clientId}: ${error}`);
          disconnectedClients.push(clientId);
        }
      }

      // Clean up disconnected clients
      disconnectedClients.forEach(clientId => {
        this.clients.delete(clientId);
      });

      log(`Sent message to ${this.clients.size} SSE clients`);
    } else if (!message.id || !this.pendingRequests.has(message.id.toString())) {
      log(`No clients connected, message: ${messageStr}`);
    }
    
    return Promise.resolve();
  }
}
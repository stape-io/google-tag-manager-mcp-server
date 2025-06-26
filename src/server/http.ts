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

  constructor(port = process.env.PORT ? parseInt(process.env.PORT) : 3000) {
    this.port = port;
    this.app = express();
    
    // Configure Express
    this.app.use(express.json({ limit: '50mb' }));
    
    // Enable CORS for remote access
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');
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
        
        // Process the message through the onmessage handler
        this.onmessage(message);
        
        // For now, just acknowledge receipt
        // The actual response will be sent via the send() method
        res.status(202).json({ status: 'accepted' });
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
        
        // Process the message through the onmessage handler
        this.onmessage(message);
        
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
    const disconnectedClients: string[] = [];

    // Send to SSE clients
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

    if (this.clients.size > 0) {
      log(`Sent message to ${this.clients.size} SSE clients`);
    } else {
      log(`No SSE clients connected, message: ${messageStr}`);
    }
    
    return Promise.resolve();
  }
}
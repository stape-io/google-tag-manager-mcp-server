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
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).send({ status: 'ok' });
    });
  }

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
   * Sends a message to connected clients.
   * 
   * Note: In a real implementation, this would use WebSockets or Server-Sent Events
   * to push messages to connected clients. For this simple example, we just log the message.
   */
  async send(message: any): Promise<void> {
    // In a real implementation, this would send the message to connected clients
    // For now, we just log it
    log(`Would send message: ${JSON.stringify(message)}`);
    return Promise.resolve();
  }
}
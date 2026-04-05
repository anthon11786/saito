/**
 * @saito/client - Lightweight TypeScript SDK for Saito Network
 *
 * A minimal client library for interacting with Saito nodes without
 * bundling the full 6.4MB WASM consensus engine.
 */

import WebSocket from 'ws';
import EventEmitter from 'events';
import * as JSON from 'json-bigint';

export interface SaitoClientConfig {
  endpoint: string;
  network?: 'mainnet' | 'testnet' | 'local';
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export interface Transaction {
  to: Array<{ publicKey: string; amount: bigint }>;
  from: Array<{ publicKey: string; amount: bigint }>;
  msg?: any;
  timestamp: number;
  signature?: string;
}

export interface Block {
  id: bigint;
  hash: string;
  timestamp: number;
  prevHash: string;
  transactions: Transaction[];
}

export class SaitoClient extends EventEmitter {
  private config: Required<SaitoClientConfig>;
  private socket: WebSocket | null = null;
  private connected: boolean = false;
  private handshakeComplete: boolean = false;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private pendingRequests: Map<number, { resolve: any; reject: any }> = new Map();
  private requestId: number = 0;

  constructor(config: SaitoClientConfig) {
    super();
    this.config = {
      network: 'mainnet',
      autoReconnect: true,
      reconnectDelay: 3000,
      ...config
    };
  }

  /**
   * Connect to a Saito node
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.config.endpoint);

      this.socket.on('open', () => {
        this.connected = true;
        this.emit('connected');
        console.log('Connected to Saito node:', this.config.endpoint);
      });

      this.socket.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.socket.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.handshakeComplete = false;
        this.emit('disconnected');

        if (this.config.autoReconnect) {
          setTimeout(() => this.connect(), this.config.reconnectDelay);
        }
      });

      // Wait for handshake to complete
      this.once('handshake-complete', () => {
        resolve();
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.handshakeComplete) {
          reject(new Error('Handshake timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Disconnect from the node
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Send a transaction to the network
   */
  async sendTransaction(tx: Transaction): Promise<string> {
    if (!this.connected || !this.handshakeComplete) {
      throw new Error('Not connected to node');
    }

    const message = {
      request: 'transaction',
      data: tx
    };

    this.sendMessage(message);

    // Return transaction signature/hash
    return tx.signature || '';
  }

  /**
   * Get balance for a public key
   */
  async getBalance(publicKey: string): Promise<bigint> {
    const response = await fetch(
      `${this.getHttpEndpoint()}/balance/${publicKey}`
    );
    const data = await response.json();
    return BigInt(data.balance || 0);
  }

  /**
   * Get a block by hash
   */
  async getBlock(hash: string, publicKey?: string): Promise<Block> {
    const url = publicKey
      ? `${this.getHttpEndpoint()}/lite-block/${hash}/${publicKey}`
      : `${this.getHttpEndpoint()}/block/${hash}`;

    const response = await fetch(url);
    return await response.json();
  }

  /**
   * Get network stats
   */
  async getStats(): Promise<any> {
    const response = await fetch(`${this.getHttpEndpoint()}/stats`);
    return await response.json();
  }

  /**
   * Get peer information
   */
  async getPeers(): Promise<any> {
    const response = await fetch(`${this.getHttpEndpoint()}/stats/peers`);
    return await response.json();
  }

  /**
   * Get node version
   */
  async getVersion(): Promise<string> {
    const response = await fetch(`${this.getHttpEndpoint()}/version`);
    const data = await response.json();
    return data.version;
  }

  /**
   * Subscribe to transactions
   */
  onTransaction(callback: (tx: Transaction) => void): void {
    this.on('transaction', callback);
  }

  /**
   * Subscribe to new blocks
   */
  onBlock(callback: (block: Block) => void): void {
    this.on('block', callback);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.request === 'handshake') {
        this.handleHandshake(message.data);
      } else if (message.request === 'transaction') {
        this.emit('transaction', message.data);
      } else if (message.request === 'block') {
        this.emit('block', message.data);
      } else {
        // Custom message types
        this.emit(`message:${message.request}`, message.data);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Handle handshake protocol
   */
  private handleHandshake(data: any): void {
    // Simplified handshake - in production, implement full protocol
    // See: /node/docs/restapi.md

    if (data.step === 1) {
      // Server initiated handshake
      const response = {
        request: 'handshake',
        data: {
          step: 2,
          ts: Date.now(),
          challenge_mine: Math.random(),
          challenge_peer: data.challenge_mine,
          challenge_proof: '', // Sign with private key
          peer: {
            publickey: '', // Client public key
            version: 5.677,
            synctype: 'none',
            sendblks: 0,
            sendtxs: 1,
            sendgts: 0,
            receiveblks: 0,
            receivetxs: 1,
            receivegts: 0
          }
        }
      };

      this.sendMessage(response);
    } else if (data.step >= 3) {
      // Handshake complete
      this.handshakeComplete = true;
      this.emit('handshake-complete');
    }
  }

  /**
   * Send a message via WebSocket
   */
  private sendMessage(message: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Get HTTP endpoint from WebSocket endpoint
   */
  private getHttpEndpoint(): string {
    const wsUrl = this.config.endpoint;
    // Convert ws://localhost:12101/wsopen -> http://localhost:12101
    return wsUrl
      .replace('ws://', 'http://')
      .replace('wss://', 'https://')
      .replace('/wsopen', '');
  }
}

// tests/unit/websocket.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';
import * as wsService from '../../src/services/websocket.service.js';

describe('WebSocket Service Unit Tests', () => {
  let server;
  let port;

  beforeEach(async () => {
    server = http.createServer();
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
    wsService.initWebSocketServer(server);
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('should accept connection and prompt for auth if token missing', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    const message = await new Promise((resolve) => {
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
    });

    expect(message.type).toBe('AUTH_REQUIRED');
    ws.close();
  });

  it('should reply with PONG on PING message', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ type: 'PING' }));

    const messages = [];
    await new Promise((resolve) => {
      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        messages.push(parsed);
        if (parsed.type === 'PONG') {
          resolve();
        }
      });
    });

    const pong = messages.find((m) => m.type === 'PONG');
    expect(pong).toBeDefined();
    expect(pong.timestamp).toBeDefined();
    ws.close();
  });
});


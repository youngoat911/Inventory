import 'dotenv/config';
import { app } from './src/app.js';
import { checkDatabase } from './src/db/pool.js';
import logger from './src/utils/logger.js';
import { initWebSocketServer } from './src/services/websocket.service.js';

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'

const startServer = async () => {
  try {
    await checkDatabase();
    logger.info({ port: PORT }, 'Database connected successfully');

    const server = app.listen(PORT, HOST,() => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, `Server listening running ${HOST} at port ${PORT}`);
    });

    // Initialize real-time WebSocket server
    initWebSocketServer(server);

    const shutdown = (signal) => {
      logger.info({ signal }, 'Shutting down server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exitCode = 1;
  }
};

startServer();

export { app };
export default app;

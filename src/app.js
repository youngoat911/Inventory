import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.routes.js';
import { checkDatabase } from './db/pool.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-Id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(requestIdMiddleware);
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger({ ignorePaths: [] }));
}

// Health endpoint (no authentication required)
app.get('/health', async (req, res) => {
  try {
    await checkDatabase();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'berm-inventory-api',
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'berm-inventory-api',
      database: 'disconnected',
    });
  }
});

// API status endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'BERM API Server',
    version: '1.0.0',
  });
});

// Mount consolidated v1 API router
app.use('/api/v1', apiRouter);

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDistPath));

  // Handle client-side routing - serve index.html for all non-API GET routes.
  // Uses app.use (no path) because a bare '*' is invalid in Express 5.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
export default app;
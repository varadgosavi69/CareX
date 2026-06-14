// Express application factory. This module builds and configures the app but does
// NOT start a server or connect to the DB — that lives in server.js so the app
// can be imported directly by tests (Supertest).

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

import { env } from './config/env.js';
import { morganStream } from './utils/logger.js';
import apiRoutes from './routes/index.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';
import { globalLimiter } from './middlewares/rateLimiter.js';

const app = express();

// Trust the first proxy (Railway/Render/Vercel) so secure cookies and client
// IPs (for rate limiting) work correctly behind a load balancer.
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────
app.use(helmet());

// ── CORS — only allow the configured frontend origin, with credentials ──
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);

// ── Body parsing (with sane size limits to blunt large-payload abuse) ──
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ── Sanitize against NoSQL injection and HTTP parameter pollution ──
app.use(mongoSanitize());
app.use(hpp());

// ── HTTP request logging (skipped during tests) ──
if (!env.isTest) {
  app.use(morgan(env.isProd ? 'combined' : 'dev', { stream: morganStream }));
}

// ── Global baseline rate limit (auth endpoints get a tighter limiter) ──
app.use('/api', globalLimiter);

// ── Routes ──
app.use('/api', apiRoutes);

// ── 404 + centralized error handling (must be last) ──
app.use(notFound);
app.use(errorHandler);

export default app;

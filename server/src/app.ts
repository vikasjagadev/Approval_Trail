import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';

import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import requestTypesRoutes from './routes/requestTypes.js';
import requestsRoutes from './routes/requests.js';
import approvalsRoutes from './routes/approvals.js';
import auditRoutes from './routes/audit.js';
import notificationsRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.CLIENT_ORIGIN,
    credentials: true,
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '100kb' }));

// Mount all routes under /api
app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', requestTypesRoutes);
app.use('/api', requestsRoutes);
app.use('/api', approvalsRoutes);
app.use('/api', auditRoutes);
app.use('/api', notificationsRoutes);
app.use('/api', dashboardRoutes);

// Central error handler
app.use(errorHandler);

export default app;


import { app } from './app.js';
import { config } from './config.js';

const server = app.listen(config.PORT, () => {
  console.log(`🚀 ApprovalTrail server running on http://localhost:${config.PORT}`);
  console.log(`📡 CORS allowed for ${config.CLIENT_ORIGIN}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});

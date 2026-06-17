import http from 'http';
import app from './app.js';
import { initWebSocket } from './services/websocket.js';

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`WebSocket server ready on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;

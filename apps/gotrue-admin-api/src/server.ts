import { loadConfig } from './config/env.js';
import { createApp } from './app.js';

function start(): void {
  const config = loadConfig(process.env);
  const { app, logger, close } = createApp(config);
  const server = app.listen(config.PORT, config.HOST, () =>
    logger.info({ port: config.PORT }, 'Operator API listening'),
  );
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => {
      server.closeAllConnections();
      process.exit(1);
    }, 10000);
    timer.unref();
    server.close(() => {
      void close().then(
        () => {
          clearTimeout(timer);
          process.exit(0);
        },
        () => process.exit(1),
      );
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  server.on('error', () => {
    logger.fatal({ code: 'LISTEN_FAILED' }, 'Operator API could not listen');
    void close().finally(() => {
      process.exitCode = 1;
    });
  });
}
try {
  start();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : 'Startup failed');
  process.exitCode = 1;
}

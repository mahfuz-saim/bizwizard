import { Server } from 'http';
import app from './app';
import config from './config';
import { errorlogger, logger } from './shared/logger';
import { ensureDemoUser } from './shared/ensureDemoUser';

async function bootstrap() {
    // Auto-seed a demo OWNER for web dev if DEMO_EMAIL / DEMO_PASSWORD are set
    await ensureDemoUser().catch(() => {});

    const server: Server = app.listen(config.port, () => {
        logger.info(`Server running on port ${config.port}`);
        console.log(`Server running on port ${config.port}`);
    });

    const exitHandler = () => {
        if (server) {
            server.close(() => {
                logger.info('Server closed');
                console.log('Server closed');
            });
        }
        process.exit(1);
    };

    const unexpectedErrorHandler = (error: unknown) => {
        errorlogger.error(error);
        console.log(error);

        exitHandler();
    };

    process.on('uncaughtException', unexpectedErrorHandler);
    process.on('unhandledRejection', unexpectedErrorHandler);

    process.on('SIGTERM', () => {
        logger.info('SIGTERM received');
        if (server) {
            server.close();
        }
    });
}

bootstrap();

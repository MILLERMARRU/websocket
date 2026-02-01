import express from 'express';
import http from 'http';
import { config } from './config/env.js';
import { database } from './config/database.js';
import { logger } from './utils/logger.js';
import { WebSocketService } from './services/websocket.service.js';
import { productService } from './services/product.service.js';
import { ProductController } from './controllers/product.controller.js';
import { createProductRoutes } from './routes/product.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

/**
 * Aplicación principal
 * Orquesta todos los componentes del sistema
 */
class Application {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.setupMiddlewares();
    this.setupServices();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  setupMiddlewares() {
    // Middleware para parsear JSON
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Middleware de logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });

    // CORS simple (para desarrollo)
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
  }

  setupServices() {
    // Inicializar WebSocket
    this.websocketService = new WebSocketService(this.server);

    // Inicializar controlador con dependencias inyectadas
    this.productController = new ProductController(
      productService,
      this.websocketService
    );
  }

  setupRoutes() {
    // Ruta de health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        websocketClients: this.websocketService.getConnectedClientsCount()
      });
    });

    // Rutas de productos
    this.app.use('/api/productos', createProductRoutes(this.productController));
  }

  setupErrorHandlers() {
    // Manejar rutas no encontradas
    this.app.use(notFoundHandler);

    // Manejador de errores global
    this.app.use(errorHandler);
  }

  async start() {
    try {
      // Verificar conexión a la base de datos
      await database.query('SELECT NOW()');
      logger.info('Conexión a PostgreSQL establecida');

      // Iniciar servidor
      this.server.listen(config.server.port, () => {
        logger.info(`🚀 Servidor HTTP ejecutándose en http://localhost:${config.server.port}`);
        logger.info(`🔌 Servidor WebSocket ejecutándose en ws://localhost:${config.server.port}`);
        logger.info(`📊 Entorno: ${config.server.env}`);
      });

      // Manejo de señales de cierre
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Error al iniciar el servidor:', error);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`\n${signal} recibido. Cerrando servidor...`);

      this.server.close(async () => {
        logger.info('Servidor HTTP cerrado');
        await database.close();
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        logger.error('Cierre forzado después de timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Iniciar la aplicación
const app = new Application();
app.start();

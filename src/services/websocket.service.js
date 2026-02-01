import { WebSocketServer } from 'ws';
import { logger } from '../utils/logger.js';

/**
 * Servicio de WebSocket
 * Principio: Single Responsibility - Solo maneja las comunicaciones WebSocket
 * Principio: Open/Closed - Abierto a extensión (nuevos tipos de eventos) cerrado a modificación
 */
export class WebSocketService {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Set();
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws) => {
      logger.info('Nuevo cliente WebSocket conectado');
      this.clients.add(ws);

      ws.on('close', () => {
        logger.info('Cliente WebSocket desconectado');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        logger.error('Error en WebSocket:', error);
        this.clients.delete(ws);
      });

      // Mensaje de bienvenida
      ws.send(JSON.stringify({
        type: 'CONNECTION_ESTABLISHED',
        message: 'Conectado al servidor WebSocket',
        timestamp: new Date().toISOString()
      }));
    });

    logger.info('Servidor WebSocket iniciado');
  }

  /**
   * Emite un evento a todos los clientes conectados
   */
  broadcast(eventType, data) {
    const message = JSON.stringify({
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;
    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
        sentCount++;
      }
    });

    logger.info(`Evento ${eventType} enviado a ${sentCount} clientes`);
  }

  /**
   * Eventos específicos del dominio
   */
  emitProductCreated(product) {
    this.broadcast('PRODUCT_CREATED', product);
  }

  emitProductUpdated(product) {
    this.broadcast('PRODUCT_UPDATED', product);
  }

  emitProductDeleted(productId) {
    this.broadcast('PRODUCT_DELETED', { id: productId });
  }

  /**
   * Obtiene el número de clientes conectados
   */
  getConnectedClientsCount() {
    return this.clients.size;
  }
}

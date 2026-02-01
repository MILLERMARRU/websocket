import { WebSocketServer } from 'ws';
import { verifyToken } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio de WebSocket SEGURO
 * Implementa autenticación, rate limiting, heartbeat y sanitización
 */
export class SecureWebSocketService {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // ws -> { userId, username, role, connectedAt, ip }
    this.connectionsByIP = new Map(); // ip -> count
    this.connectionsByUser = new Map(); // userId -> count

    // Configuración
    this.maxConnectionsPerIP = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP || '10');
    this.maxConnectionsPerUser = parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER || '5');
    this.allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;
      const origin = req.headers.origin;

      // 1. VALIDAR ORIGEN
      if (origin && !this.allowedOrigins.includes(origin)) {
        logger.warn(`Conexión rechazada: Origen no permitido: ${origin}`);
        ws.close(1008, 'Origen no permitido');
        return;
      }

      // 2. RATE LIMITING POR IP
      const ipConnections = this.connectionsByIP.get(ip) || 0;
      if (ipConnections >= this.maxConnectionsPerIP) {
        logger.warn(`Rate limit excedido para IP: ${ip}`);
        ws.close(1008, 'Demasiadas conexiones desde esta IP');
        return;
      }

      // 3. EXTRAER Y VERIFICAR TOKEN
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('Conexión rechazada: Sin token');
        ws.close(1008, 'Token requerido');
        return;
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        logger.warn('Conexión rechazada: Token inválido');
        ws.close(1008, 'Token inválido o expirado');
        return;
      }

      // 4. LIMITAR CONEXIONES POR USUARIO
      const userConnections = this.connectionsByUser.get(decoded.userId) || 0;
      if (userConnections >= this.maxConnectionsPerUser) {
        logger.warn(`Usuario ${decoded.userId} excedió límite de conexiones`);
        ws.close(1008, 'Demasiadas conexiones activas');
        return;
      }

      // 5. REGISTRAR CLIENTE
      const metadata = {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role || 'user',
        connectedAt: new Date(),
        lastActivity: Date.now(),
        ip: ip
      };

      this.clients.set(ws, metadata);

      // Actualizar contadores
      this.connectionsByIP.set(ip, ipConnections + 1);
      this.connectionsByUser.set(decoded.userId, userConnections + 1);

      logger.info(`✅ Usuario ${decoded.username} (${decoded.userId}) conectado vía WebSocket`);

      // 6. CONFIGURAR HEARTBEAT
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
        this.updateActivity(ws);
      });

      // 7. EVENTOS
      ws.on('close', () => {
        this.handleDisconnection(ws, metadata, ip);
      });

      ws.on('error', (error) => {
        logger.error('Error en WebSocket:', error);
        this.handleDisconnection(ws, metadata, ip);
      });

      // Mensaje de bienvenida
      this.sendToClient(ws, {
        type: 'CONNECTION_ESTABLISHED',
        message: `Bienvenido ${decoded.username}`,
        connectedClients: this.clients.size
      });
    });

    logger.info('🔒 Servidor WebSocket seguro iniciado');
  }

  /**
   * Maneja la desconexión de un cliente
   */
  handleDisconnection(ws, metadata, ip) {
    logger.info(`❌ Usuario ${metadata.username} desconectado`);

    // Remover cliente
    this.clients.delete(ws);

    // Actualizar contadores
    const ipCount = this.connectionsByIP.get(ip) || 0;
    if (ipCount > 0) {
      this.connectionsByIP.set(ip, ipCount - 1);
    }

    const userCount = this.connectionsByUser.get(metadata.userId) || 0;
    if (userCount > 0) {
      this.connectionsByUser.set(metadata.userId, userCount - 1);
    }
  }

  /**
   * Actualiza la última actividad de un cliente
   */
  updateActivity(ws) {
    const metadata = this.clients.get(ws);
    if (metadata) {
      metadata.lastActivity = Date.now();
    }
  }

  /**
   * Inicia el sistema de heartbeat
   * - Detecta conexiones muertas
   * - Desconecta usuarios inactivos
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const inactivityTimeout = 3600000; // 1 hora

      this.clients.forEach((metadata, ws) => {
        // Verificar heartbeat
        if (ws.isAlive === false) {
          logger.info(`Terminando conexión zombie de ${metadata.username}`);
          return ws.terminate();
        }

        // Verificar inactividad
        const inactiveTime = now - metadata.lastActivity;
        if (inactiveTime > inactivityTimeout) {
          logger.info(`Desconectando usuario inactivo: ${metadata.username}`);
          ws.close(1000, 'Sesión expirada por inactividad');
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Cada 30 segundos
  }

  /**
   * Envía mensaje a un cliente específico
   */
  sendToClient(ws, data) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify({
        ...data,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Broadcast a todos los clientes autenticados
   */
  broadcast(eventType, data) {
    const sanitizedData = this.sanitizeData(data);
    const message = {
      type: eventType,
      data: sanitizedData
    };

    let sentCount = 0;

    this.clients.forEach((metadata, ws) => {
      this.sendToClient(ws, message);
      sentCount++;
    });

    logger.info(`📡 Evento ${eventType} enviado a ${sentCount} clientes`);
  }

  /**
   * Broadcast solo a usuarios con rol específico
   */
  broadcastToRole(eventType, data, role) {
    const sanitizedData = this.sanitizeData(data);
    const message = {
      type: eventType,
      data: sanitizedData
    };

    let sentCount = 0;

    this.clients.forEach((metadata, ws) => {
      if (metadata.role === role) {
        this.sendToClient(ws, message);
        sentCount++;
      }
    });

    logger.info(`📡 Evento ${eventType} enviado a ${sentCount} usuarios con rol ${role}`);
  }

  /**
   * Broadcast solo a usuarios específicos
   */
  broadcastToUsers(eventType, data, userIds) {
    const sanitizedData = this.sanitizeData(data);
    const message = {
      type: eventType,
      data: sanitizedData
    };

    let sentCount = 0;

    this.clients.forEach((metadata, ws) => {
      if (userIds.includes(metadata.userId)) {
        this.sendToClient(ws, message);
        sentCount++;
      }
    });

    logger.info(`📡 Evento ${eventType} enviado a ${sentCount} usuarios específicos`);
  }

  /**
   * Sanitiza datos eliminando información sensible
   */
  sanitizeData(data) {
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (data && typeof data === 'object') {
      const sanitized = { ...data };

      // Lista de campos sensibles a eliminar
      const sensitiveFields = [
        'password',
        'token',
        'secret',
        'apiKey',
        'precioCosto',
        'margen',
        'proveedor',
        'internalNotes'
      ];

      sensitiveFields.forEach(field => {
        delete sanitized[field];
      });

      return sanitized;
    }

    return data;
  }

  /**
   * Desconecta a un usuario específico
   */
  disconnectUser(userId, reason = 'Desconectado por el servidor') {
    let disconnectedCount = 0;

    this.clients.forEach((metadata, ws) => {
      if (metadata.userId === userId) {
        ws.close(1000, reason);
        disconnectedCount++;
      }
    });

    logger.info(`Desconectadas ${disconnectedCount} sesiones del usuario ${userId}`);
  }

  /**
   * Obtiene estadísticas de conexiones
   */
  getStats() {
    const uniqueUsers = new Set();
    const connectionsByRole = {};

    this.clients.forEach((metadata) => {
      uniqueUsers.add(metadata.userId);
      connectionsByRole[metadata.role] = (connectionsByRole[metadata.role] || 0) + 1;
    });

    return {
      totalConnections: this.clients.size,
      uniqueUsers: uniqueUsers.size,
      connectionsByRole,
      connectionsByIP: Object.fromEntries(this.connectionsByIP),
      connectionsByUser: Object.fromEntries(this.connectionsByUser)
    };
  }

  /**
   * Cierra el servidor y limpia recursos
   */
  close() {
    clearInterval(this.heartbeatInterval);

    // Cerrar todas las conexiones
    this.clients.forEach((metadata, ws) => {
      ws.close(1000, 'Servidor cerrándose');
    });

    this.wss.close();
    logger.info('Servidor WebSocket cerrado');
  }

  // Eventos específicos del dominio
  emitProductCreated(product) {
    this.broadcast('PRODUCT_CREATED', product);
  }

  emitProductUpdated(product) {
    this.broadcast('PRODUCT_UPDATED', product);
  }

  emitProductDeleted(productId) {
    this.broadcast('PRODUCT_DELETED', { id: productId });
  }
}

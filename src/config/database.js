import pg from 'pg';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

/**
 * Pool de conexiones a PostgreSQL
 * Principio: Single Responsibility - Solo maneja la conexión a la base de datos
 */
class Database {
  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      max: config.database.max
    });

    this.pool.on('connect', () => {
      logger.info('Nueva conexión establecida con PostgreSQL');
    });

    this.pool.on('error', (err) => {
      logger.error('Error inesperado en el pool de PostgreSQL:', err);
    });
  }

  /**
   * Ejecuta una query en la base de datos
   */
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Query ejecutada en ${duration}ms: ${text}`);
      return result;
    } catch (error) {
      logger.error('Error ejecutando query:', error);
      throw error;
    }
  }

  /**
   * Obtiene un cliente para transacciones
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Cierra el pool de conexiones
   */
  async close() {
    await this.pool.end();
    logger.info('Pool de conexiones cerrado');
  }
}

export const database = new Database();

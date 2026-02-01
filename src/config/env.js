import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuración centralizada de variables de entorno
 * Principio: Single Responsibility - Solo maneja la configuración del entorno
 */
export const config = {
  server: {
    port: process.env.PORT || 3000,
    wsPort: process.env.WS_PORT || 3001,
    env: process.env.NODE_ENV || 'development'
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5434'),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_NAME || 'productos_db',
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20')
  }
};

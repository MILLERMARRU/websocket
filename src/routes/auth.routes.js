import express from 'express';
import { generateToken, authenticateHTTP } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

/**
 * Rutas de autenticación
 * NOTA: En producción, validar contra base de datos
 */
export const createAuthRoutes = () => {
  const router = express.Router();

  /**
   * POST /auth/login
   * Login y generación de token
   */
  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Validación básica
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Usuario y contraseña requeridos'
      });
    }

    // TODO: En producción, validar contra base de datos
    // Este es un ejemplo simplificado
    const users = [
      { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
      { id: 2, username: 'user', password: 'user123', role: 'user' }
    ];

    const user = users.find(
      u => u.username === username && u.password === password
    );

    if (!user) {
      logger.warn(`Intento de login fallido para usuario: ${username}`);
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generateToken(user.id, user.username, user.role);

    logger.info(`Usuario ${username} autenticado exitosamente`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
  });

  /**
   * GET /auth/verify
   * Verifica si un token es válido
   */
  router.get('/verify', authenticateHTTP, (req, res) => {
    res.json({
      success: true,
      user: req.user
    });
  });

  /**
   * POST /auth/logout
   * Logout (en cliente: eliminar token)
   */
  router.post('/logout', authenticateHTTP, (req, res) => {
    logger.info(`Usuario ${req.user.username} cerró sesión`);

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  });

  return router;
};

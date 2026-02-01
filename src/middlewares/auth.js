import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION';

/**
 * Verifica un token JWT
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Genera un token JWT
 */
export function generateToken(userId, username, role = 'user') {
  return jwt.sign(
    { userId, username, role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

/**
 * Middleware para proteger rutas HTTP
 */
export function authenticateHTTP(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token no proporcionado'
    });
  }

  const token = authHeader.substring(7); // Remover "Bearer "
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }

  // Agregar usuario al request
  req.user = decoded;
  next();
}

/**
 * Middleware para verificar rol
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes'
      });
    }

    next();
  };
}

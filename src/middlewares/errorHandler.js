import { logger } from '../utils/logger.js';

/**
 * Middleware de manejo de errores centralizado
 * Principio: Single Responsibility - Solo maneja errores
 */
export const errorHandler = (err, req, res, next) => {
  logger.error('Error capturado:', err);

  // Error de validación
  if (err.validationErrors) {
    return res.status(400).json({
      success: false,
      error: err.message,
      validationErrors: err.validationErrors
    });
  }

  // Error de producto no encontrado
  if (err.message === 'Producto no encontrado') {
    return res.status(404).json({
      success: false,
      error: err.message
    });
  }

  // Error de base de datos
  if (err.code && err.code.startsWith('23')) { // Códigos PostgreSQL de violación de constraints
    return res.status(400).json({
      success: false,
      error: 'Error de validación en la base de datos',
      details: err.detail || err.message
    });
  }

  // Error genérico del servidor
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

/**
 * Middleware para rutas no encontradas
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.path
  });
};

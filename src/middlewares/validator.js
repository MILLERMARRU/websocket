/**
 * Middleware de validación de parámetros
 * Principio: Single Responsibility - Solo valida parámetros de entrada
 */

/**
 * Valida que el ID sea un número válido
 */
export const validateId = (req, res, next) => {
  const { id } = req.params;
  const numId = parseInt(id);

  if (isNaN(numId) || numId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'ID inválido',
      message: 'El ID debe ser un número entero positivo'
    });
  }

  next();
};

/**
 * Valida que el body contenga datos
 */
export const validateBody = (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Body vacío',
      message: 'El cuerpo de la petición no puede estar vacío'
    });
  }

  next();
};

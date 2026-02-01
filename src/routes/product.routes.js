import express from 'express';
import { validateId, validateBody } from '../middlewares/validator.js';

/**
 * Configura las rutas de productos
 * Principio: Open/Closed - Abierto a extensión, cerrado a modificación
 */
export const createProductRoutes = (productController) => {
  const router = express.Router();

  // GET /api/productos - Obtener todos los productos
  router.get('/', (req, res, next) => {
    productController.getAllProducts(req, res, next);
  });

  // GET /api/productos/:id - Obtener un producto por ID
  router.get('/:id', validateId, (req, res, next) => {
    productController.getProductById(req, res, next);
  });

  // POST /api/productos - Crear un nuevo producto
  router.post('/', validateBody, (req, res, next) => {
    productController.createProduct(req, res, next);
  });

  // PUT /api/productos/:id - Actualizar un producto
  router.put('/:id', validateId, validateBody, (req, res, next) => {
    productController.updateProduct(req, res, next);
  });

  // DELETE /api/productos/:id - Eliminar un producto
  router.delete('/:id', validateId, (req, res, next) => {
    productController.deleteProduct(req, res, next);
  });

  return router;
};

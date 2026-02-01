import { productService } from '../services/product.service.js';

/**
 * Controlador de Productos
 * Principio: Single Responsibility - Solo maneja las peticiones HTTP de productos
 * Principio: Dependency Inversion - Depende del servicio (abstracción)
 */
export class ProductController {
  constructor(service, websocketService) {
    this.productService = service;
    this.websocketService = websocketService;
  }

  /**
   * GET /api/productos
   */
  async getAllProducts(req, res, next) {
    try {
      const products = await this.productService.getAllProducts();
      res.json({
        success: true,
        data: products,
        count: products.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/productos/:id
   */
  async getProductById(req, res, next) {
    try {
      const { id } = req.params;
      const product = await this.productService.getProductById(parseInt(id));
      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/productos
   */
  async createProduct(req, res, next) {
    try {
      const product = await this.productService.createProduct(req.body);

      // Emitir evento WebSocket
      this.websocketService.emitProductCreated(product);

      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/productos/:id
   */
  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await this.productService.updateProduct(parseInt(id), req.body);

      // Emitir evento WebSocket
      this.websocketService.emitProductUpdated(product);

      res.json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/productos/:id
   */
  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await this.productService.deleteProduct(parseInt(id));

      // Emitir evento WebSocket
      this.websocketService.emitProductDeleted(product.id);

      res.json({
        success: true,
        message: 'Producto eliminado exitosamente',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }
}

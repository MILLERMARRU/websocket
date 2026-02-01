import { Product } from '../models/product.model.js';
import { ProductRepository } from '../repositories/product.repository.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio de Productos
 * Principio: Single Responsibility - Maneja la lógica de negocio de productos
 * Principio: Dependency Inversion - Depende de abstracciones (repository)
 */
export class ProductService {
  constructor(productRepository) {
    this.productRepository = productRepository;
  }

  /**
   * Obtiene todos los productos
   */
  async getAllProducts() {
    try {
      return await this.productRepository.findAll();
    } catch (error) {
      logger.error('Error obteniendo productos:', error);
      throw new Error('Error al obtener los productos');
    }
  }

  /**
   * Obtiene un producto por ID
   */
  async getProductById(id) {
    try {
      const product = await this.productRepository.findById(id);

      if (!product) {
        throw new Error('Producto no encontrado');
      }

      return product;
    } catch (error) {
      logger.error(`Error obteniendo producto ${id}:`, error);
      throw error;
    }
  }

  /**
   * Crea un nuevo producto
   */
  async createProduct(productData) {
    try {
      // Validar datos
      const validation = Product.validate(productData);
      if (!validation.isValid) {
        const error = new Error('Datos de producto inválidos');
        error.validationErrors = validation.errors;
        throw error;
      }

      // Sanitizar y crear
      const sanitizedData = Product.sanitize(productData);
      const product = await this.productRepository.create(sanitizedData);

      logger.info(`Producto creado: ${product.id}`);
      return product;
    } catch (error) {
      logger.error('Error creando producto:', error);
      throw error;
    }
  }

  /**
   * Actualiza un producto existente
   */
  async updateProduct(id, productData) {
    try {
      // Validar que el producto existe
      await this.getProductById(id);

      // Validar datos
      const validation = Product.validate(productData);
      if (!validation.isValid) {
        const error = new Error('Datos de producto inválidos');
        error.validationErrors = validation.errors;
        throw error;
      }

      // Sanitizar y actualizar
      const sanitizedData = Product.sanitize(productData);
      const product = await this.productRepository.update(id, sanitizedData);

      logger.info(`Producto actualizado: ${product.id}`);
      return product;
    } catch (error) {
      logger.error(`Error actualizando producto ${id}:`, error);
      throw error;
    }
  }

  /**
   * Elimina un producto
   */
  async deleteProduct(id) {
    try {
      // Validar que el producto existe
      await this.getProductById(id);

      const product = await this.productRepository.delete(id);

      logger.info(`Producto eliminado: ${id}`);
      return product;
    } catch (error) {
      logger.error(`Error eliminando producto ${id}:`, error);
      throw error;
    }
  }
}

// Exportar instancia del servicio con sus dependencias inyectadas
export const productService = new ProductService(new ProductRepository());

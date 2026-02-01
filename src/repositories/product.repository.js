import { database } from '../config/database.js';
import { Product } from '../models/product.model.js';

/**
 * Repositorio de Productos
 * Principio: Single Responsibility - Solo maneja la persistencia de productos
 * Principio: Dependency Inversion - Depende de abstracciones (database) no de implementaciones concretas
 */
export class ProductRepository {
  /**
   * Obtiene todos los productos
   */
  async findAll() {
    const query = 'SELECT * FROM productos ORDER BY id ASC';
    const result = await database.query(query);
    return result.rows.map(row => new Product(row));
  }

  /**
   * Obtiene un producto por ID
   */
  async findById(id) {
    const query = 'SELECT * FROM productos WHERE id = $1';
    const result = await database.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Product(result.rows[0]);
  }

  /**
   * Crea un nuevo producto
   */
  async create(productData) {
    const query = `
      INSERT INTO productos (nombre, descripcion, precio, stock)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      productData.nombre,
      productData.descripcion,
      productData.precio,
      productData.stock
    ];

    const result = await database.query(query, values);
    return new Product(result.rows[0]);
  }

  /**
   * Actualiza un producto existente
   */
  async update(id, productData) {
    const query = `
      UPDATE productos
      SET nombre = $1, descripcion = $2, precio = $3, stock = $4
      WHERE id = $5
      RETURNING *
    `;

    const values = [
      productData.nombre,
      productData.descripcion,
      productData.precio,
      productData.stock,
      id
    ];

    const result = await database.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return new Product(result.rows[0]);
  }

  /**
   * Elimina un producto
   */
  async delete(id) {
    const query = 'DELETE FROM productos WHERE id = $1 RETURNING *';
    const result = await database.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Product(result.rows[0]);
  }
}

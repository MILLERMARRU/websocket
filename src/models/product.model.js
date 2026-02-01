/**
 * Modelo de Producto
 * Principio: Single Responsibility - Define la estructura y validación de un producto
 */
export class Product {
  constructor({ id, nombre, descripcion, precio, stock, created_at, updated_at }) {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.precio = precio;
    this.stock = stock;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  /**
   * Valida que los datos del producto sean correctos
   */
  static validate(data) {
    const errors = [];

    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim().length === 0) {
      errors.push('El nombre es requerido y debe ser una cadena de texto');
    }

    if (data.nombre && data.nombre.length > 255) {
      errors.push('El nombre no puede exceder 255 caracteres');
    }

    if (data.precio === undefined || data.precio === null) {
      errors.push('El precio es requerido');
    }

    if (typeof data.precio !== 'number' || data.precio < 0) {
      errors.push('El precio debe ser un número mayor o igual a 0');
    }

    if (data.stock !== undefined && (typeof data.stock !== 'number' || data.stock < 0)) {
      errors.push('El stock debe ser un número mayor o igual a 0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitiza los datos de entrada
   */
  static sanitize(data) {
    return {
      nombre: data.nombre?.trim(),
      descripcion: data.descripcion?.trim() || null,
      precio: parseFloat(data.precio),
      stock: data.stock !== undefined ? parseInt(data.stock) : 0
    };
  }
}

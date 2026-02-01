-- Creación de la tabla productos
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL CHECK (precio >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);

-- Función para actualizar automáticamente updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_productos_updated_at
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Datos de ejemplo
INSERT INTO productos (nombre, descripcion, precio, stock) VALUES
    ('Laptop Dell XPS 13', 'Laptop ultraligera con procesador Intel i7', 1299.99, 15),
    ('Mouse Logitech MX Master 3', 'Mouse ergonómico inalámbrico', 99.99, 45),
    ('Teclado Mecánico Keychron K2', 'Teclado mecánico compacto RGB', 79.99, 30)
ON CONFLICT DO NOTHING;

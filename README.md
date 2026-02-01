# Backend REST API + WebSocket

Backend completo en Node.js con Express que expone un CRUD RESTful para productos e integra WebSocket para notificaciones en tiempo real.

## 🏗️ Arquitectura

El proyecto sigue principios SOLID y una arquitectura en capas:

```
src/
├── config/          # Configuración (DB, env)
├── models/          # Modelos de datos y validaciones
├── repositories/    # Capa de persistencia (acceso a DB)
├── services/        # Lógica de negocio
├── controllers/     # Controladores HTTP
├── routes/          # Definición de rutas
├── middlewares/     # Middlewares (validación, errores)
└── utils/           # Utilidades (logger)
```

### Flujo de Datos

```
Cliente HTTP → Routes → Middlewares → Controller → Service → Repository → PostgreSQL
                                           ↓
                                    WebSocket Service → Clientes WS
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js >= 18
- Docker y Docker Compose

### Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Iniciar la base de datos PostgreSQL:
```bash
docker compose up -d
```

3. Configurar variables de entorno (ya existe el archivo `.env`):
```bash
# El archivo .env ya está configurado con valores por defecto
```

4. Iniciar el servidor:
```bash
npm start
# O en modo desarrollo con auto-reload:
npm run dev
```

El servidor estará disponible en:
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`
- Health Check: `http://localhost:3000/health`

## 📡 API Endpoints

### Productos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/productos` | Obtener todos los productos |
| GET | `/api/productos/:id` | Obtener un producto por ID |
| POST | `/api/productos` | Crear un nuevo producto |
| PUT | `/api/productos/:id` | Actualizar un producto |
| DELETE | `/api/productos/:id` | Eliminar un producto |

### Ejemplos de Uso

**Crear producto:**
```bash
curl -X POST http://localhost:3000/api/productos \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Producto Ejemplo",
    "descripcion": "Descripción del producto",
    "precio": 99.99,
    "stock": 10
  }'
```

**Obtener todos los productos:**
```bash
curl http://localhost:3000/api/productos
```

**Actualizar producto:**
```bash
curl -X PUT http://localhost:3000/api/productos/1 \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Producto Actualizado",
    "descripcion": "Nueva descripción",
    "precio": 149.99,
    "stock": 5
  }'
```

**Eliminar producto:**
```bash
curl -X DELETE http://localhost:3000/api/productos/1
```

## 🔌 WebSocket

### Conexión

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Evento recibido:', message);
};
```

### Eventos Emitidos

Cuando se realizan operaciones de escritura vía HTTP, el servidor emite eventos WebSocket:

- `CONNECTION_ESTABLISHED` - Al conectarse al WebSocket
- `PRODUCT_CREATED` - Cuando se crea un producto
- `PRODUCT_UPDATED` - Cuando se actualiza un producto
- `PRODUCT_DELETED` - Cuando se elimina un producto

### Ejemplo de Mensaje

```json
{
  "type": "PRODUCT_CREATED",
  "data": {
    "id": 1,
    "nombre": "Producto Ejemplo",
    "descripcion": "Descripción",
    "precio": 99.99,
    "stock": 10,
    "created_at": "2024-01-30T10:00:00.000Z",
    "updated_at": "2024-01-30T10:00:00.000Z"
  },
  "timestamp": "2024-01-30T10:00:00.000Z"
}
```

## 🗄️ Base de Datos

### Esquema de Productos

```sql
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL CHECK (precio >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Gestión de Docker

```bash
# Iniciar base de datos
docker compose up -d

# Ver logs
docker compose logs -f

# Detener
docker compose down

# Detener y eliminar datos
docker compose down -v
```

### Acceso directo a PostgreSQL

```bash
docker exec -it productos_db psql -U admin -d productos_db
```

## 🧪 Validaciones

El modelo de producto valida:

- **nombre**: Requerido, string, máximo 255 caracteres
- **precio**: Requerido, número >= 0
- **stock**: Opcional, número >= 0, default: 0
- **descripcion**: Opcional, texto

## 🛠️ Principios SOLID Aplicados

### Single Responsibility Principle (SRP)
- Cada clase tiene una única responsabilidad
- `ProductRepository` → Solo persistencia
- `ProductService` → Solo lógica de negocio
- `ProductController` → Solo manejo de HTTP

### Open/Closed Principle (OCP)
- WebSocketService abierto a nuevos eventos sin modificar código existente
- Rutas configurables mediante funciones factory

### Liskov Substitution Principle (LSP)
- Las dependencias pueden ser sustituidas por sus abstracciones

### Interface Segregation Principle (ISP)
- Interfaces específicas y pequeñas

### Dependency Inversion Principle (DIP)
- Controladores dependen de servicios (abstracciones)
- Servicios dependen de repositorios (abstracciones)
- Inyección de dependencias en constructores

## 📁 Estructura del Proyecto

```
back/
├── src/
│   ├── config/
│   │   ├── database.js          # Configuración de PostgreSQL
│   │   └── env.js                # Variables de entorno
│   ├── models/
│   │   └── product.model.js      # Modelo y validaciones
│   ├── repositories/
│   │   └── product.repository.js # Acceso a datos
│   ├── services/
│   │   ├── product.service.js    # Lógica de negocio
│   │   └── websocket.service.js  # Gestión de WebSocket
│   ├── controllers/
│   │   └── product.controller.js # Controlador HTTP
│   ├── routes/
│   │   └── product.routes.js     # Definición de rutas
│   ├── middlewares/
│   │   ├── errorHandler.js       # Manejo de errores
│   │   └── validator.js          # Validaciones
│   ├── utils/
│   │   └── logger.js             # Sistema de logging
│   └── app.js                    # Aplicación principal
├── compose.yml                   # Docker Compose
├── init.sql                      # Script de inicialización DB
├── package.json
├── .env
└── README.md
```

## 🔒 Manejo de Errores

El sistema maneja diferentes tipos de errores:

- **400 Bad Request**: Validación fallida, datos inválidos
- **404 Not Found**: Recurso no encontrado
- **500 Internal Server Error**: Errores del servidor

Formato de respuesta de error:
```json
{
  "success": false,
  "error": "Mensaje de error",
  "validationErrors": ["error1", "error2"]
}
```

## 📝 Notas de Desarrollo

- Las operaciones de **escritura** (POST, PUT, DELETE) solo se realizan vía HTTP
- Una vez confirmada la operación HTTP, se emite un evento WebSocket
- El servidor es la **única fuente de verdad**
- Los clientes WebSocket reciben notificaciones pero no pueden modificar datos
- El código prioriza **claridad** sobre optimización prematura

# 🔌 Guía Completa de WebSocket en el Proyecto

## 📋 Tabla de Contenidos

1. [¿Qué es WebSocket?](#qué-es-websocket)
2. [Diferencias entre HTTP y WebSocket](#diferencias-entre-http-y-websocket)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Implementación en el Backend](#implementación-en-el-backend)
5. [Implementación en el Cliente HTML](#implementación-en-el-cliente-html)
6. [Flujo de Comunicación Completo](#flujo-de-comunicación-completo)
7. [Eventos y Mensajes](#eventos-y-mensajes)
8. [Casos de Uso Reales](#casos-de-uso-reales)
9. [Manejo de Errores y Reconexión](#manejo-de-errores-y-reconexión)

---

## ¿Qué es WebSocket?

WebSocket es un **protocolo de comunicación bidireccional** que permite establecer una conexión persistente entre el cliente y el servidor. A diferencia de HTTP (que es unidireccional), WebSocket permite que **ambos** el servidor y el cliente envíen mensajes en cualquier momento.

### Características Principales

✅ **Comunicación en tiempo real**: Los datos fluyen instantáneamente en ambas direcciones
✅ **Conexión persistente**: Una sola conexión permanece abierta (no se cierra después de cada mensaje)
✅ **Bajo overhead**: Después del handshake inicial, los mensajes tienen muy poca sobrecarga
✅ **Full-duplex**: Cliente y servidor pueden enviar mensajes simultáneamente

---

## Diferencias entre HTTP y WebSocket

### HTTP (Protocolo Request-Response)

```
Cliente                    Servidor
   |                          |
   |-------- REQUEST -------->|  (1. Cliente pide datos)
   |                          |
   |<------- RESPONSE --------|  (2. Servidor responde)
   |                          |
   | (Conexión cerrada)       |
   |                          |
   |-------- REQUEST -------->|  (3. Nueva petición = nueva conexión)
   |<------- RESPONSE --------|
   |                          |
```

**Limitaciones de HTTP:**
- El cliente siempre debe iniciar la comunicación
- El servidor no puede "empujar" datos al cliente
- Cada petición requiere headers completos (overhead)
- Para actualizaciones en tiempo real, se requiere polling (ineficiente)

### WebSocket (Comunicación Bidireccional)

```
Cliente                    Servidor
   |                          |
   |------ HANDSHAKE -------->|  (1. Upgrade a WebSocket)
   |<----- HANDSHAKE ---------|
   |                          |
   |====== CONEXIÓN ABIERTA ==|  (Permanece abierta)
   |                          |
   |<------- MENSAJE ---------|  (Servidor puede enviar cuando quiera)
   |-------- MENSAJE -------->|  (Cliente puede enviar cuando quiera)
   |<------- MENSAJE ---------|
   |-------- MENSAJE -------->|
   |                          |
   |====== SIEMPRE ACTIVA =====|
```

**Ventajas de WebSocket:**
- Comunicación bidireccional simultánea
- El servidor puede enviar datos sin que el cliente lo solicite
- Baja latencia (sin overhead de headers HTTP en cada mensaje)
- Ideal para notificaciones en tiempo real

---

## Arquitectura del Sistema

### Arquitectura Completa del Proyecto

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA GENERAL                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐                    ┌──────────────────────────┐
│  Cliente Web     │                    │   Backend Node.js        │
│  (Navegador)     │                    │   Express + WebSocket    │
└──────────────────┘                    └──────────────────────────┘
        │                                           │
        │                                           │
        ├─────── HTTP REST API ────────────────────┤
        │        (Escritura)                        │
        │                                           │
        │  POST /api/productos                      │
        │  PUT /api/productos/:id                   │
        │  DELETE /api/productos/:id                │
        │                                           │
        │         ┌─────────────────┐               │
        │         │  PostgreSQL     │<──────────────┤
        │         │  (Base de Datos)│               │
        │         └─────────────────┘               │
        │                                           │
        │                                           │
        ├═══════ WebSocket Connection ═════════════┤
        │        (Solo Notificaciones)              │
        │                                           │
        │  ← PRODUCT_CREATED                        │
        │  ← PRODUCT_UPDATED                        │
        │  ← PRODUCT_DELETED                        │
        │                                           │
        └───────────────────────────────────────────┘
```

### Flujo de Datos: Principio de "Single Source of Truth"

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE ESCRITURA Y NOTIFICACIÓN             │
└─────────────────────────────────────────────────────────────────┘

1. Cliente hace una operación de escritura vía HTTP:

   Cliente (HTML)
      │
      │ POST /api/productos
      │ { nombre: "Laptop", precio: 999.99 }
      ▼
   Express Routes
      │
      │ Validación de datos
      ▼
   ProductController
      │
      │ createProduct()
      ▼
   ProductService
      │
      │ Validar y Sanitizar
      ▼
   ProductRepository
      │
      │ INSERT INTO productos...
      ▼
   PostgreSQL ✅ (Guardado exitoso)
      │
      │ Retorna producto creado
      ▼
   ProductController
      │
      │ 1. Envía respuesta HTTP al cliente
      │ 2. Emite evento WebSocket
      ▼
   WebSocketService
      │
      │ broadcast('PRODUCT_CREATED', producto)
      ▼
   Todos los clientes WebSocket conectados recibirán:
   {
     type: 'PRODUCT_CREATED',
     data: { id: 1, nombre: 'Laptop', ... },
     timestamp: '2024-01-30T10:00:00.000Z'
   }
```

---

## Implementación en el Backend

### 1. WebSocketService - El Corazón del Sistema

**Archivo:** `src/services/websocket.service.js`

```javascript
import { WebSocketServer } from 'ws';
import { logger } from '../utils/logger.js';

export class WebSocketService {
  constructor(server) {
    // Crea el servidor WebSocket usando el servidor HTTP existente
    this.wss = new WebSocketServer({ server });

    // Set para almacenar todos los clientes conectados
    this.clients = new Set();

    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    // Evento: Cuando un nuevo cliente se conecta
    this.wss.on('connection', (ws) => {
      logger.info('Nuevo cliente WebSocket conectado');

      // Agregar cliente al Set
      this.clients.add(ws);

      // Evento: Cuando el cliente cierra la conexión
      ws.on('close', () => {
        logger.info('Cliente WebSocket desconectado');
        this.clients.delete(ws); // Remover del Set
      });

      // Evento: Cuando hay un error
      ws.on('error', (error) => {
        logger.error('Error en WebSocket:', error);
        this.clients.delete(ws);
      });

      // Mensaje de bienvenida al conectarse
      ws.send(JSON.stringify({
        type: 'CONNECTION_ESTABLISHED',
        message: 'Conectado al servidor WebSocket',
        timestamp: new Date().toISOString()
      }));
    });
  }

  /**
   * FUNCIÓN CLAVE: broadcast()
   * Envía un mensaje a TODOS los clientes conectados
   */
  broadcast(eventType, data) {
    const message = JSON.stringify({
      type: eventType,      // Tipo de evento
      data,                 // Datos del evento
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;

    // Iterar sobre todos los clientes
    this.clients.forEach((client) => {
      // Verificar que el cliente esté conectado
      if (client.readyState === 1) { // 1 = WebSocket.OPEN
        client.send(message);  // Enviar mensaje
        sentCount++;
      }
    });

    logger.info(`Evento ${eventType} enviado a ${sentCount} clientes`);
  }

  // Métodos específicos del dominio (productos)
  emitProductCreated(product) {
    this.broadcast('PRODUCT_CREATED', product);
  }

  emitProductUpdated(product) {
    this.broadcast('PRODUCT_UPDATED', product);
  }

  emitProductDeleted(productId) {
    this.broadcast('PRODUCT_DELETED', { id: productId });
  }
}
```

#### 🔍 Explicación Detallada del Código

##### Constructor
```javascript
constructor(server) {
  this.wss = new WebSocketServer({ server });
  this.clients = new Set();
  this.setupWebSocketServer();
}
```

- **`WebSocketServer({ server })`**: Crea el servidor WebSocket adjunto al servidor HTTP de Express
- **`this.clients = new Set()`**: Usamos un `Set` (no un array) porque:
  - Inserción/eliminación O(1)
  - No permite duplicados
  - Fácil iterar

##### Evento `connection`
```javascript
this.wss.on('connection', (ws) => {
  this.clients.add(ws);
  // ...
});
```

Cada vez que un cliente abre una conexión WebSocket, se dispara este evento. El parámetro `ws` es la **instancia de conexión individual** de ese cliente.

##### Broadcast
```javascript
broadcast(eventType, data) {
  const message = JSON.stringify({ type: eventType, data, timestamp });

  this.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}
```

- **Serializamos a JSON** porque WebSocket solo envía strings o buffers
- **Verificamos `readyState === 1`** para asegurar que el cliente esté conectado
- Estados posibles: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED

### 2. Integración en el Controller

**Archivo:** `src/controllers/product.controller.js`

```javascript
export class ProductController {
  constructor(service, websocketService) {
    this.productService = service;
    this.websocketService = websocketService; // Inyección de dependencia
  }

  async createProduct(req, res, next) {
    try {
      // 1. Crear producto en la base de datos
      const product = await this.productService.createProduct(req.body);

      // 2. Emitir evento WebSocket a todos los clientes
      this.websocketService.emitProductCreated(product);

      // 3. Responder al cliente HTTP que hizo la petición
      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await this.productService.updateProduct(parseInt(id), req.body);

      // Notificar a todos los clientes WebSocket
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

  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await this.productService.deleteProduct(parseInt(id));

      // Notificar eliminación
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
```

#### 🔍 Flujo en el Controller

```
1. Cliente HTTP hace POST /api/productos
        ↓
2. Controller llama a ProductService
        ↓
3. ProductService guarda en DB
        ↓
4. Controller emite evento WebSocket ←─── CLAVE
        ↓
5. Controller responde al cliente HTTP
```

**Orden de operaciones importante:**
1. ✅ Primero guardar en DB
2. ✅ Luego emitir evento WebSocket
3. ✅ Finalmente responder al cliente HTTP

Si la DB falla, no se emite evento WebSocket (garantiza consistencia).

### 3. Inicialización en app.js

**Archivo:** `src/app.js`

```javascript
class Application {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app); // Servidor HTTP
    this.setupMiddlewares();
    this.setupServices();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  setupServices() {
    // Inicializar WebSocket usando el servidor HTTP
    this.websocketService = new WebSocketService(this.server);

    // Inyectar WebSocketService en el controlador
    this.productController = new ProductController(
      productService,
      this.websocketService  // ← Inyección de dependencia
    );
  }

  async start() {
    // Iniciar servidor HTTP (que también maneja WebSocket)
    this.server.listen(config.server.port, () => {
      logger.info(`🚀 Servidor HTTP en http://localhost:${config.server.port}`);
      logger.info(`🔌 WebSocket en ws://localhost:${config.server.port}`);
    });
  }
}
```

#### 🔍 ¿Por qué usar `http.createServer`?

```javascript
// ❌ INCORRECTO - WebSocket no funcionaría
const app = express();
app.listen(3000);

// ✅ CORRECTO - Permite HTTP y WebSocket en el mismo puerto
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
server.listen(3000);
```

WebSocket requiere el servidor HTTP subyacente para hacer el "upgrade" del protocolo HTTP a WebSocket.

---

## Implementación en el Cliente HTML

**Archivo:** `client-example.html`

### 1. Conexión WebSocket en el Cliente

```javascript
const WS_URL = 'ws://localhost:3000';
let ws;

// Función para conectar al WebSocket
function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  // Evento: Conexión abierta exitosamente
  ws.onopen = () => {
    console.log('✅ Conectado al WebSocket');
    connectionStatus.textContent = '✅ Conectado al WebSocket';
    connectionStatus.className = 'connection-status connected';
    addEventToLog('Conexión establecida', 'info');
  };

  // Evento: Mensaje recibido desde el servidor
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };

  // Evento: Conexión cerrada
  ws.onclose = () => {
    console.log('❌ Desconectado');
    connectionStatus.textContent = '❌ Desconectado';
    connectionStatus.className = 'connection-status disconnected';

    // Reconectar automáticamente después de 3 segundos
    setTimeout(connectWebSocket, 3000);
  };

  // Evento: Error en la conexión
  ws.onerror = (error) => {
    console.error('Error WebSocket:', error);
  };
}

// Iniciar conexión al cargar la página
connectWebSocket();
```

#### 🔍 Eventos del WebSocket del Cliente

| Evento | Cuándo se dispara | Qué hacer |
|--------|-------------------|-----------|
| `onopen` | Conexión establecida exitosamente | Actualizar UI, cargar datos iniciales |
| `onmessage` | Se recibe un mensaje del servidor | Procesar el mensaje y actualizar UI |
| `onclose` | Conexión cerrada (voluntaria o no) | Intentar reconectar |
| `onerror` | Error en la conexión | Loggear error, intentar reconectar |

### 2. Manejo de Mensajes Recibidos

```javascript
// Función que procesa mensajes del servidor
function handleWebSocketMessage(message) {
  const { type, data, timestamp } = message;

  // Switch basado en el tipo de evento
  switch(type) {
    case 'CONNECTION_ESTABLISHED':
      addEventToLog('Conexión establecida con el servidor', 'info');
      loadProducts(); // Cargar productos iniciales
      break;

    case 'PRODUCT_CREATED':
      addEventToLog(`Producto creado: ${data.nombre}`, 'created', data);
      loadProducts(); // Recargar lista de productos
      break;

    case 'PRODUCT_UPDATED':
      addEventToLog(`Producto actualizado: ${data.nombre}`, 'updated', data);
      loadProducts();
      break;

    case 'PRODUCT_DELETED':
      addEventToLog(`Producto eliminado (ID: ${data.id})`, 'deleted', data);
      loadProducts();
      break;

    default:
      console.log('Evento desconocido:', type);
  }
}
```

#### 🔍 Estructura del Mensaje

Todos los mensajes que el servidor envía tienen este formato:

```javascript
{
  type: 'PRODUCT_CREATED',           // Tipo de evento
  data: {                             // Datos del evento
    id: 1,
    nombre: 'Laptop',
    precio: 999.99,
    stock: 10,
    created_at: '2024-01-30T10:00:00.000Z',
    updated_at: '2024-01-30T10:00:00.000Z'
  },
  timestamp: '2024-01-30T10:00:05.123Z'  // Cuándo se emitió
}
```

### 3. Operaciones HTTP desde el Cliente

```javascript
// Crear producto vía HTTP (NO WebSocket)
document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const productData = {
    nombre: document.getElementById('nombre').value,
    descripcion: document.getElementById('descripcion').value,
    precio: parseFloat(document.getElementById('precio').value),
    stock: parseInt(document.getElementById('stock').value)
  };

  try {
    // 1. Enviar petición HTTP POST
    const response = await fetch('http://localhost:3000/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    const result = await response.json();

    if (result.success) {
      // 2. Respuesta HTTP recibida
      document.getElementById('createForm').reset();
      alert('✅ Producto creado exitosamente');

      // 3. Automáticamente recibiremos un evento WebSocket
      //    con type='PRODUCT_CREATED' que actualizará la UI
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error al crear el producto');
  }
});
```

#### 🔍 Flujo Completo de Creación

```
Cliente HTML
    │
    │ 1. Usuario llena formulario y presiona "Crear"
    ▼
fetch POST /api/productos
    │
    │ 2. Envía datos vía HTTP
    ▼
Servidor recibe, valida, guarda en DB
    │
    │ 3. Servidor emite evento WebSocket a TODOS los clientes
    ▼
Evento WebSocket recibido (PRODUCT_CREATED)
    │
    │ 4. handleWebSocketMessage() procesa el evento
    ▼
loadProducts() recarga la lista
    │
    │ 5. UI actualizada con el nuevo producto
    ▼
✅ Usuario ve el producto en la lista
```

### 4. Actualización Automática de la UI

```javascript
// Cargar productos desde el API
async function loadProducts() {
  try {
    const response = await fetch('http://localhost:3000/api/productos');
    const result = await response.json();

    if (result.success) {
      displayProducts(result.data);
    }
  } catch (error) {
    console.error('Error cargando productos:', error);
  }
}

// Mostrar productos en tarjetas
function displayProducts(products) {
  productList.innerHTML = products.map(product => `
    <div class="product-card">
      <h3>${product.nombre}</h3>
      <p>${product.descripcion || 'Sin descripción'}</p>
      <p class="price">$${product.precio}</p>
      <p>Stock: ${product.stock} unidades</p>
      <div class="button-group">
        <button onclick="editProduct(${product.id})">✏️ Editar</button>
        <button onclick="deleteProduct(${product.id})">🗑️ Eliminar</button>
      </div>
    </div>
  `).join('');
}
```

### 5. Visualización de Eventos en Tiempo Real

```javascript
// Agregar evento al log visual
function addEventToLog(message, type, data = null) {
  const eventItem = document.createElement('div');
  eventItem.className = `event-item ${type}`;

  let content = `
    <div class="event-type">${message}</div>
    <div class="event-timestamp">${new Date().toLocaleTimeString()}</div>
  `;

  // Si hay datos, mostrarlos en formato JSON
  if (data) {
    content += `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  eventItem.innerHTML = content;

  // Insertar al inicio (eventos más recientes arriba)
  eventsLog.insertBefore(eventItem, eventsLog.firstChild);
}
```

---

## Flujo de Comunicación Completo

### Escenario: Dos usuarios crean productos simultáneamente

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Cliente A   │         │   Servidor   │         │  Cliente B   │
│  (Juan)      │         │              │         │  (María)     │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       │═══ WebSocket Abierto ══╪═══ WebSocket Abierto ═│
       │                        │                        │
       │                        │                        │
       │ POST /api/productos    │                        │
       │ {nombre: "Mouse"}      │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │                        │ 1. Valida              │
       │                        │ 2. Guarda en DB        │
       │                        │ 3. Emite WebSocket     │
       │                        │                        │
       │ HTTP Response 201      │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │ WS: PRODUCT_CREATED    │ WS: PRODUCT_CREATED    │
       │<═══════════════════════╪═══════════════════════>│
       │ {nombre: "Mouse"}      │ {nombre: "Mouse"}      │
       │                        │                        │
       │ ✅ Juan ve el Mouse    │ ✅ María ve el Mouse   │
       │    en su lista         │    en su lista         │
       │                        │                        │
       │                        │                        │
       │                        │ POST /api/productos    │
       │                        │ {nombre: "Teclado"}    │
       │                        │<───────────────────────│
       │                        │                        │
       │                        │ 1. Valida              │
       │                        │ 2. Guarda en DB        │
       │                        │ 3. Emite WebSocket     │
       │                        │                        │
       │                        │ HTTP Response 201      │
       │                        │───────────────────────>│
       │                        │                        │
       │ WS: PRODUCT_CREATED    │ WS: PRODUCT_CREATED    │
       │<═══════════════════════╪═══════════════════════>│
       │ {nombre: "Teclado"}    │ {nombre: "Teclado"}    │
       │                        │                        │
       │ ✅ Juan ve el Teclado  │ ✅ María ve el Teclado │
       │    en su lista         │    en su lista         │
       │                        │                        │
```

### Análisis del Flujo

1. **Cliente A (Juan)** crea un producto "Mouse"
   - Envía HTTP POST
   - Recibe respuesta HTTP confirmando creación
   - Recibe evento WebSocket `PRODUCT_CREATED`
   - Actualiza su UI

2. **Cliente B (María)** que NO hizo la petición:
   - ✨ Automáticamente recibe el mismo evento WebSocket
   - Su UI se actualiza SIN necesidad de refrescar la página
   - Ve el producto de Juan en tiempo real

3. **Cliente B (María)** crea un producto "Teclado"
   - El proceso se invierte
   - Ahora Juan ve el producto de María en tiempo real

---

## Eventos y Mensajes

### Tipos de Eventos

#### 1. `CONNECTION_ESTABLISHED`

**Cuándo:** Al establecer conexión WebSocket

**Enviado por:** Servidor

**Ejemplo:**
```json
{
  "type": "CONNECTION_ESTABLISHED",
  "message": "Conectado al servidor WebSocket",
  "timestamp": "2024-01-30T10:00:00.000Z"
}
```

**Qué hacer en el cliente:**
- Mostrar indicador de conexión
- Cargar datos iniciales

#### 2. `PRODUCT_CREATED`

**Cuándo:** Después de crear un producto vía POST

**Enviado por:** Servidor (después de guardar en DB)

**Ejemplo:**
```json
{
  "type": "PRODUCT_CREATED",
  "data": {
    "id": 5,
    "nombre": "Laptop Dell",
    "descripcion": "Laptop potente",
    "precio": 1299.99,
    "stock": 10,
    "created_at": "2024-01-30T10:00:00.000Z",
    "updated_at": "2024-01-30T10:00:00.000Z"
  },
  "timestamp": "2024-01-30T10:00:01.234Z"
}
```

**Qué hacer en el cliente:**
- Agregar producto a la lista
- Mostrar notificación "Nuevo producto agregado"
- Actualizar contador de productos

#### 3. `PRODUCT_UPDATED`

**Cuándo:** Después de actualizar un producto vía PUT

**Enviado por:** Servidor

**Ejemplo:**
```json
{
  "type": "PRODUCT_UPDATED",
  "data": {
    "id": 5,
    "nombre": "Laptop Dell XPS (Actualizado)",
    "descripcion": "Nueva descripción",
    "precio": 1499.99,
    "stock": 5,
    "created_at": "2024-01-30T10:00:00.000Z",
    "updated_at": "2024-01-30T10:05:00.000Z"
  },
  "timestamp": "2024-01-30T10:05:01.123Z"
}
```

**Qué hacer en el cliente:**
- Encontrar producto por ID en la lista
- Actualizar sus datos
- Mostrar notificación "Producto actualizado"

#### 4. `PRODUCT_DELETED`

**Cuándo:** Después de eliminar un producto vía DELETE

**Enviado por:** Servidor

**Ejemplo:**
```json
{
  "type": "PRODUCT_DELETED",
  "data": {
    "id": 5
  },
  "timestamp": "2024-01-30T10:10:00.000Z"
}
```

**Qué hacer en el cliente:**
- Remover producto de la lista por ID
- Mostrar notificación "Producto eliminado"
- Actualizar contador

---

## Casos de Uso Reales

### Caso 1: Dashboard de Ventas en Tiempo Real

**Escenario:** Tienes una tienda online con múltiples vendedores.

```javascript
// Vendedor A actualiza stock desde su terminal
PUT /api/productos/10
{
  "nombre": "Laptop",
  "precio": 999.99,
  "stock": 3  // ← Stock reducido de 10 a 3
}

// Todos los dashboards conectados reciben:
WS: PRODUCT_UPDATED
{
  type: 'PRODUCT_UPDATED',
  data: { id: 10, stock: 3, ... }
}

// ✅ Todos los vendedores ven el stock actualizado instantáneamente
// ✅ Evita sobre-ventas
```

### Caso 2: Notificaciones Multi-Usuario

**Escenario:** Sistema de gestión de inventario con varios administradores.

```javascript
// Admin A elimina un producto descontinuado
DELETE /api/productos/15

// Todos los admins reciben notificación:
WS: PRODUCT_DELETED
{
  type: 'PRODUCT_DELETED',
  data: { id: 15 }
}

// En el cliente:
handleWebSocketMessage(message) {
  if (message.type === 'PRODUCT_DELETED') {
    showNotification(`⚠️ Producto ${message.data.id} eliminado por otro usuario`);
    removeProductFromUI(message.data.id);
  }
}
```

### Caso 3: Sincronización de Múltiples Pestañas

**Escenario:** Usuario tiene la app abierta en 2 pestañas.

```
Pestaña 1                 Servidor                Pestaña 2
    │                        │                        │
    │ Crea producto          │                        │
    │───────────────────────>│                        │
    │                        │                        │
    │ Response 201           │                        │
    │<───────────────────────│                        │
    │                        │                        │
    │ WS: PRODUCT_CREATED    │ WS: PRODUCT_CREATED    │
    │<═══════════════════════╪═══════════════════════>│
    │                        │                        │
    │ ✅ Ve producto         │ ✅ Ve producto         │
```

Ambas pestañas se mantienen sincronizadas automáticamente.

---

## Manejo de Errores y Reconexión

### Estrategia de Reconexión Automática

```javascript
function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('✅ Conectado');
    connectionStatus.className = 'connected';
  };

  ws.onclose = () => {
    console.log('❌ Desconectado. Reconectando en 3s...');
    connectionStatus.className = 'disconnected';

    // Reconectar después de 3 segundos
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error('Error:', error);
    // El evento onclose se disparará automáticamente
  };
}
```

### Backoff Exponencial (Mejora)

Para evitar sobrecarga del servidor, incrementa el tiempo entre intentos:

```javascript
let reconnectDelay = 1000; // Inicial: 1 segundo
const maxReconnectDelay = 30000; // Máximo: 30 segundos

function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('✅ Conectado');
    reconnectDelay = 1000; // Reset delay al conectar exitosamente
  };

  ws.onclose = () => {
    console.log(`❌ Desconectado. Reintentando en ${reconnectDelay/1000}s...`);

    setTimeout(connectWebSocket, reconnectDelay);

    // Incrementar delay exponencialmente
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  };
}
```

### Detección de Pérdida de Conexión (Heartbeat)

```javascript
let heartbeatInterval;

ws.onopen = () => {
  console.log('✅ Conectado');

  // Enviar ping cada 30 segundos
  heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PING' }));
    }
  }, 30000);
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'PONG') {
    console.log('💓 Heartbeat OK');
  } else {
    handleWebSocketMessage(message);
  }
};

ws.onclose = () => {
  clearInterval(heartbeatInterval); // Limpiar heartbeat
  // ... reconectar
};
```

---

## Comparación: Antes y Después de WebSocket

### SIN WebSocket (Polling)

```javascript
// ❌ Ineficiente: Consultar servidor cada 5 segundos
setInterval(async () => {
  const response = await fetch('/api/productos');
  const products = await response.json();
  updateUI(products);
}, 5000);
```

**Problemas:**
- 🔴 Consumo innecesario de recursos (12 peticiones por minuto)
- 🔴 Delay de hasta 5 segundos para ver cambios
- 🔴 Sobrecarga del servidor con peticiones inútiles
- 🔴 Mayor uso de ancho de banda

### CON WebSocket

```javascript
// ✅ Eficiente: El servidor "empuja" cambios
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'PRODUCT_CREATED') {
    updateUI(message.data);
  }
};
```

**Ventajas:**
- 🟢 Actualizaciones instantáneas (< 100ms)
- 🟢 Solo se envían datos cuando HAY cambios
- 🟢 Mínimo uso de recursos
- 🟢 Escalable a miles de clientes

---

## Diagrama Final: Arquitectura Completa

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUJO COMPLETO DEL SISTEMA                   │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  Cliente HTML        │
│  client-example.html │
└──────────────────────┘
         │
         │ ┌─────────────────────────────────────────────────┐
         │ │ 1. Conexión WebSocket al iniciar                │
         │ │    ws = new WebSocket('ws://localhost:3000')    │
         │ └─────────────────────────────────────────────────┘
         │
         ├═══════════════════════════════════════════════════════╗
         ║                                                       ║
         ║  WebSocket Connection (Bidireccional)                ║
         ║  - Recibe: PRODUCT_CREATED, UPDATED, DELETED         ║
         ║  - Estado: Siempre abierta                           ║
         ║                                                       ║
         ╚═══════════════════════════════════════════════════════╣
                                                                 ║
         ┌───────────────────────────────────────────────────────╨───┐
         │  Backend: src/app.js                                      │
         │  ┌─────────────────────────────────────────────────────┐  │
         │  │ HTTP Server (Express)                               │  │
         │  │ - Maneja REST API                                   │  │
         │  └─────────────────────────────────────────────────────┘  │
         │  ┌─────────────────────────────────────────────────────┐  │
         │  │ WebSocket Server (ws)                               │  │
         │  │ - Maneja conexiones WebSocket                       │  │
         │  │ - Broadcast a clientes                              │  │
         │  └─────────────────────────────────────────────────────┘  │
         └────────────────────────────────────────────────────────────┘
         │                                │
         │ HTTP Request                   │ WebSocket Events
         │ POST/PUT/DELETE                │ PRODUCT_CREATED/UPDATED/DELETED
         ▼                                ▼
┌─────────────────────┐          ┌──────────────────────┐
│ ProductController   │          │ WebSocketService     │
│                     │          │                      │
│ - createProduct()   │──────────│ - broadcast()        │
│ - updateProduct()   │  Emite   │ - emitProductCreated │
│ - deleteProduct()   │  Evento  │ - clients: Set       │
└─────────────────────┘          └──────────────────────┘
         │                                │
         │ Llama                          │ Envía a todos
         ▼                                │ los clientes
┌─────────────────────┐                   │
│ ProductService      │                   │
│                     │                   │
│ - Validación        │                   │
│ - Lógica negocio    │                   │
└─────────────────────┘                   │
         │                                │
         │ Persiste                       │
         ▼                                │
┌─────────────────────┐                   │
│ ProductRepository   │                   │
│                     │                   │
│ - CRUD en DB        │                   │
└─────────────────────┘                   │
         │                                │
         │ SQL                            │
         ▼                                │
┌─────────────────────┐                   │
│ PostgreSQL          │                   │
│                     │                   │
│ - Tabla productos   │                   │
└─────────────────────┘                   │
                                          │
         ╔════════════════════════════════╝
         ║
         ║ Broadcast WebSocket
         ║
         ▼
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ Cliente 1            │    │ Cliente 2            │    │ Cliente N            │
│ (Actualiza UI)       │    │ (Actualiza UI)       │    │ (Actualiza UI)       │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

---

## Resumen de Conceptos Clave

### ✅ WebSocket vs HTTP

| Característica | HTTP | WebSocket |
|----------------|------|-----------|
| Dirección | Unidireccional | Bidireccional |
| Conexión | Se cierra después de cada petición | Permanece abierta |
| Iniciador | Solo el cliente | Cliente o servidor |
| Overhead | Alto (headers en cada petición) | Bajo (después del handshake) |
| Latencia | Alta | Muy baja |
| Uso ideal | Operaciones CRUD, descarga de datos | Notificaciones en tiempo real |

### ✅ Principios de la Arquitectura

1. **Single Source of Truth**: Solo HTTP escribe, WebSocket notifica
2. **Separation of Concerns**: HTTP para operaciones, WebSocket para eventos
3. **Broadcast Pattern**: Un evento se envía a TODOS los clientes conectados
4. **Event-Driven**: El sistema reacciona a eventos, no a polling

### ✅ Flujo de Datos

```
Escritura:  Cliente → HTTP → Backend → Database → WebSocket → Todos los clientes
Lectura:    Cliente → HTTP → Backend → Database → Cliente
```

### ✅ Garantías del Sistema

- ✅ Los eventos WebSocket solo se emiten si la operación DB fue exitosa
- ✅ Todos los clientes reciben el mismo evento al mismo tiempo
- ✅ Si el WebSocket falla, se reconecta automáticamente
- ✅ El estado siempre se obtiene de la DB (fuente de verdad)

---

## Próximos Pasos de Aprendizaje

1. **Agregar autenticación** al WebSocket (verificar tokens)
2. **Implementar salas** (rooms) para enviar eventos solo a ciertos clientes
3. **Agregar compresión** de mensajes para reducir ancho de banda
4. **Implementar eventos bidireccionales** (cliente puede enviar mensajes al servidor)
5. **Agregar persistencia de eventos** (guardar eventos en DB para clientes offline)

---

¡Ahora tienes un entendimiento completo de cómo funciona WebSocket en tu proyecto! 🚀

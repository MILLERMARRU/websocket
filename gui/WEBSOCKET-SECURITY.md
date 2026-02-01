# 🔐 Seguridad en WebSocket - Riesgos y Soluciones

## ⚠️ ¿Es Peligroso Tener WebSocket Siempre Abierto?

**Respuesta corta: SÍ, si no implementas medidas de seguridad adecuadas.**

El código actual en este proyecto es **educativo** y **NO está listo para producción** porque tiene varias vulnerabilidades de seguridad.

---

## 📋 Tabla de Contenidos

1. [Vulnerabilidades del Código Actual](#vulnerabilidades-del-código-actual)
2. [Riesgos de Seguridad](#riesgos-de-seguridad)
3. [Soluciones Implementadas](#soluciones-implementadas)
4. [Código Seguro para Producción](#código-seguro-para-producción)
5. [Mejores Prácticas](#mejores-prácticas)

---

## Vulnerabilidades del Código Actual

### ❌ 1. Sin Autenticación

```javascript
// CÓDIGO ACTUAL (VULNERABLE)
this.wss.on('connection', (ws) => {
  // ¡CUALQUIERA puede conectarse!
  this.clients.add(ws);
  // No se verifica identidad
});
```

**Problema:** Cualquier persona con acceso a `ws://localhost:3000` puede:
- ✅ Conectarse sin credenciales
- ✅ Recibir TODOS los eventos en tiempo real
- ✅ Ver información de productos, precios, stock
- ✅ Mantener conexiones abiertas indefinidamente

### ❌ 2. Sin Validación de Origen (CORS)

```javascript
// No hay verificación de origen
this.wss.on('connection', (ws, req) => {
  // No verificamos de dónde viene la petición
  // Un sitio malicioso puede conectarse
});
```

**Ataque posible:**
```javascript
// Sitio malicioso: https://sitio-malo.com
<script>
  const ws = new WebSocket('ws://tu-servidor.com');
  ws.onmessage = (event) => {
    // Robar información en tiempo real
    enviarAServidorMalicioso(event.data);
  };
</script>
```

### ❌ 3. Sin Rate Limiting

```javascript
// Cualquiera puede:
// 1. Abrir 10,000 conexiones WebSocket
// 2. Saturar el servidor
// 3. Causar un DoS (Denial of Service)

for (let i = 0; i < 10000; i++) {
  new WebSocket('ws://localhost:3000');
}
```

### ❌ 4. Sin Validación de Mensajes

```javascript
// Si permitiéramos que clientes envíen mensajes:
ws.on('message', (message) => {
  // No hay validación, sanitización, ni límites
  // Vulnerable a inyección de código
});
```

### ❌ 5. Fuga de Información

```javascript
// Todos los clientes reciben TODOS los eventos
this.broadcast('PRODUCT_CREATED', product);

// ¿Qué pasa si el producto tiene información sensible?
// - Precio de costo
// - Margen de ganancia
// - Datos internos
```

---

## Riesgos de Seguridad

### 🔴 1. Cross-Site WebSocket Hijacking (CSWSH)

**¿Qué es?**
Un atacante crea un sitio web malicioso que abre conexiones WebSocket a tu servidor usando las credenciales del usuario víctima.

**Escenario:**
```
1. Usuario está logueado en tu-app.com
2. Usuario visita sitio-malicioso.com
3. sitio-malicioso.com ejecuta:
   const ws = new WebSocket('ws://tu-app.com');
4. El navegador envía las cookies automáticamente
5. El atacante recibe todos los eventos en tiempo real
```

**Diagrama:**
```
┌──────────────┐
│   Usuario    │
│  (Víctima)   │
└──────────────┘
       │
       │ 1. Logueado en tu-app.com
       │    (Tiene sesión activa)
       │
       ├──────────────────────────────────┐
       │                                  │
       ▼                                  ▼
┌──────────────┐              ┌──────────────────┐
│  tu-app.com  │              │ sitio-malo.com   │
│  (Legítimo)  │              │  (Malicioso)     │
└──────────────┘              └──────────────────┘
       ▲                                  │
       │                                  │
       │ 2. sitio-malo.com abre WebSocket│
       │    ws://tu-app.com              │
       │<─────────────────────────────────┘
       │
       │ 3. Navegador envía cookies automáticamente
       │
       ├─ WebSocket conectado ✅
       │
       │ 4. Eventos fluyen al sitio malicioso
       └──> PRODUCT_CREATED, PRODUCT_UPDATED...
            ¡El atacante ve todo en tiempo real!
```

### 🔴 2. Denial of Service (DoS)

**Ataque de Conexiones Masivas:**
```javascript
// Atacante ejecuta:
const connections = [];
for (let i = 0; i < 100000; i++) {
  connections.push(new WebSocket('ws://tu-servidor.com'));
}

// Resultado:
// - Servidor saturado
// - Memoria agotada
// - Usuarios legítimos no pueden conectarse
```

**Recursos consumidos:**
- Cada conexión WebSocket consume ~10KB de memoria
- 10,000 conexiones = ~100MB solo en conexiones
- CPU procesando handshakes
- Ancho de banda saturado

### 🔴 3. Inyección de Datos Maliciosos

Si permitieras que clientes envíen mensajes:

```javascript
// Cliente malicioso envía:
ws.send(JSON.stringify({
  type: 'PRODUCT_CREATED',
  data: {
    nombre: '<script>alert("XSS")</script>',
    precio: -9999999,  // Precio negativo
    stock: 'DROP TABLE productos;--'  // SQL Injection
  }
}));
```

### 🔴 4. Fuga de Información Sensible

```javascript
// Todos los clientes conectados reciben:
{
  type: 'PRODUCT_CREATED',
  data: {
    nombre: 'Producto VIP',
    precioCosto: 50,      // ❌ Información interna
    precioVenta: 100,
    margen: 50,           // ❌ Información interna
    proveedor: 'ABC Corp' // ❌ Información interna
  }
}
```

### 🔴 5. Conexiones Zombies

```javascript
// Cliente cierra navegador pero la conexión queda abierta
// Servidor sigue enviando mensajes al vacío
// Memoria y recursos desperdiciados
```

---

## Soluciones Implementadas

### ✅ 1. Autenticación con JWT

#### Backend: Verificar Token al Conectar

```javascript
// src/middlewares/auth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secret-super-seguro';

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function generateToken(userId, username) {
  return jwt.sign(
    { userId, username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}
```

#### WebSocket Service con Autenticación

```javascript
// src/services/websocket.service.js (SEGURO)
import { WebSocketServer } from 'ws';
import { verifyToken } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export class WebSocketService {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // Map en vez de Set (guarda metadata)
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      // 1. EXTRAER TOKEN de la URL
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('Conexión rechazada: Sin token');
        ws.close(1008, 'Token requerido'); // Código 1008 = Policy Violation
        return;
      }

      // 2. VERIFICAR TOKEN
      const decoded = verifyToken(token);
      if (!decoded) {
        logger.warn('Conexión rechazada: Token inválido');
        ws.close(1008, 'Token inválido');
        return;
      }

      // 3. VALIDAR ORIGEN (CORS para WebSocket)
      const origin = req.headers.origin;
      const allowedOrigins = [
        'http://localhost:3000',
        'https://tu-dominio.com'
      ];

      if (origin && !allowedOrigins.includes(origin)) {
        logger.warn(`Conexión rechazada: Origen no permitido: ${origin}`);
        ws.close(1008, 'Origen no permitido');
        return;
      }

      // 4. RATE LIMITING - Máximo 5 conexiones por usuario
      const existingConnections = Array.from(this.clients.values())
        .filter(client => client.userId === decoded.userId);

      if (existingConnections.length >= 5) {
        logger.warn(`Usuario ${decoded.userId} excedió límite de conexiones`);
        ws.close(1008, 'Demasiadas conexiones');
        return;
      }

      // 5. GUARDAR METADATA del cliente
      this.clients.set(ws, {
        userId: decoded.userId,
        username: decoded.username,
        connectedAt: new Date(),
        ip: req.socket.remoteAddress
      });

      logger.info(`Usuario ${decoded.username} (${decoded.userId}) conectado vía WebSocket`);

      // 6. HEARTBEAT - Detectar conexiones muertas
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Eventos
      ws.on('close', () => {
        logger.info(`Usuario ${decoded.username} desconectado`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        logger.error('Error en WebSocket:', error);
        this.clients.delete(ws);
      });

      // Mensaje de bienvenida
      ws.send(JSON.stringify({
        type: 'CONNECTION_ESTABLISHED',
        message: `Bienvenido ${decoded.username}`,
        timestamp: new Date().toISOString()
      }));
    });

    // 7. HEARTBEAT INTERVAL - Limpiar conexiones muertas cada 30s
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.info('Terminando conexión zombie');
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    logger.info('Servidor WebSocket seguro iniciado');
  }

  /**
   * Broadcast a todos los usuarios autenticados
   */
  broadcast(eventType, data) {
    const message = JSON.stringify({
      type: eventType,
      data: this.sanitizeData(data), // Sanitizar datos
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;

    this.clients.forEach((metadata, ws) => {
      if (ws.readyState === 1) {
        ws.send(message);
        sentCount++;
      }
    });

    logger.info(`Evento ${eventType} enviado a ${sentCount} clientes autenticados`);
  }

  /**
   * Broadcast solo a usuarios específicos
   */
  broadcastToUsers(userIds, eventType, data) {
    const message = JSON.stringify({
      type: eventType,
      data: this.sanitizeData(data),
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;

    this.clients.forEach((metadata, ws) => {
      if (userIds.includes(metadata.userId) && ws.readyState === 1) {
        ws.send(message);
        sentCount++;
      }
    });

    logger.info(`Evento ${eventType} enviado a ${sentCount} usuarios específicos`);
  }

  /**
   * Sanitizar datos antes de enviar
   * Eliminar información sensible
   */
  sanitizeData(data) {
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (data && typeof data === 'object') {
      const sanitized = { ...data };

      // Eliminar campos sensibles
      delete sanitized.precioCosto;
      delete sanitized.margen;
      delete sanitized.proveedor;
      delete sanitized.password;
      delete sanitized.token;

      return sanitized;
    }

    return data;
  }

  /**
   * Obtener estadísticas de conexiones
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      uniqueUsers: new Set(
        Array.from(this.clients.values()).map(c => c.userId)
      ).size,
      connections: Array.from(this.clients.values()).map(c => ({
        userId: c.userId,
        username: c.username,
        connectedAt: c.connectedAt,
        duration: Date.now() - c.connectedAt.getTime()
      }))
    };
  }

  /**
   * Desconectar usuario específico
   */
  disconnectUser(userId, reason = 'Desconectado por el servidor') {
    this.clients.forEach((metadata, ws) => {
      if (metadata.userId === userId) {
        ws.close(1000, reason);
        this.clients.delete(ws);
      }
    });
  }

  /**
   * Limpiar recursos al cerrar servidor
   */
  close() {
    clearInterval(this.heartbeatInterval);
    this.wss.close();
  }
}
```

### ✅ 2. Cliente con Autenticación

```javascript
// client-example.html (SEGURO)

// 1. Usuario debe autenticarse primero vía HTTP
async function login(username, password) {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const result = await response.json();

  if (result.success) {
    // Guardar token en localStorage
    localStorage.setItem('token', result.token);
    localStorage.setItem('username', result.username);

    // Conectar WebSocket con el token
    connectWebSocket(result.token);
  }
}

// 2. Conectar WebSocket CON TOKEN
function connectWebSocket(token) {
  // Enviar token como query parameter
  const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

  ws.onopen = () => {
    console.log('✅ Conectado (autenticado)');
  };

  ws.onerror = (error) => {
    console.error('Error:', error);
    // Si el token expiró, pedir login nuevamente
    if (error.code === 1008) {
      alert('Sesión expirada. Por favor inicia sesión.');
      showLoginForm();
    }
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };

  ws.onclose = (event) => {
    console.log('Desconectado:', event.reason);

    // Reconectar con el mismo token (si no expiró)
    if (event.code !== 1008) {
      setTimeout(() => {
        const token = localStorage.getItem('token');
        if (token) {
          connectWebSocket(token);
        }
      }, 3000);
    }
  };
}

// 3. Al cargar la página, verificar si hay token
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');

  if (token) {
    connectWebSocket(token);
  } else {
    showLoginForm();
  }
});
```

### ✅ 3. Rate Limiting por IP

```javascript
// src/middlewares/rateLimiter.js
export class RateLimiter {
  constructor(maxConnections = 10, timeWindow = 60000) {
    this.connections = new Map(); // IP -> [timestamps]
    this.maxConnections = maxConnections;
    this.timeWindow = timeWindow;
  }

  isAllowed(ip) {
    const now = Date.now();
    const timestamps = this.connections.get(ip) || [];

    // Filtrar timestamps dentro de la ventana de tiempo
    const recentTimestamps = timestamps.filter(
      t => now - t < this.timeWindow
    );

    if (recentTimestamps.length >= this.maxConnections) {
      return false;
    }

    // Agregar nuevo timestamp
    recentTimestamps.push(now);
    this.connections.set(ip, recentTimestamps);

    return true;
  }

  cleanup() {
    const now = Date.now();
    this.connections.forEach((timestamps, ip) => {
      const recent = timestamps.filter(t => now - t < this.timeWindow);
      if (recent.length === 0) {
        this.connections.delete(ip);
      } else {
        this.connections.set(ip, recent);
      }
    });
  }
}

// Usar en WebSocketService
const rateLimiter = new RateLimiter(10, 60000); // 10 conexiones por minuto

this.wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;

  if (!rateLimiter.isAllowed(ip)) {
    logger.warn(`Rate limit excedido para IP: ${ip}`);
    ws.close(1008, 'Demasiadas conexiones. Intenta más tarde.');
    return;
  }

  // ... resto del código
});

// Limpiar cada 5 minutos
setInterval(() => rateLimiter.cleanup(), 300000);
```

### ✅ 4. Variables de Entorno Seguras

```bash
# .env
JWT_SECRET=tu-secret-super-seguro-de-al-menos-32-caracteres
JWT_EXPIRES_IN=24h
WS_MAX_CONNECTIONS_PER_USER=5
WS_RATE_LIMIT_CONNECTIONS=10
WS_RATE_LIMIT_WINDOW=60000
ALLOWED_ORIGINS=http://localhost:3000,https://tu-dominio.com
```

### ✅ 5. Endpoint de Login

```javascript
// src/routes/auth.routes.js
import express from 'express';
import { generateToken } from '../middlewares/auth.js';

export const createAuthRoutes = () => {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // AQUÍ: Validar usuario contra base de datos
    // Este es un ejemplo simplificado
    if (username === 'admin' && password === 'admin123') {
      const token = generateToken(1, username);

      res.json({
        success: true,
        token,
        username,
        expiresIn: '24h'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }
  });

  return router;
};

// En app.js
this.app.use('/auth', createAuthRoutes());
```

---

## Comparación: Antes vs Después

### ❌ ANTES (Inseguro)

```javascript
// Cualquiera puede conectarse
this.wss.on('connection', (ws) => {
  this.clients.add(ws);
  // Sin autenticación
  // Sin validación de origen
  // Sin rate limiting
  // Sin sanitización
});

// Cliente
const ws = new WebSocket('ws://localhost:3000');
// Conecta sin problemas
```

**Riesgos:**
- ⚠️ Acceso no autorizado
- ⚠️ Fuga de información
- ⚠️ Ataques DoS
- ⚠️ CSWSH

### ✅ DESPUÉS (Seguro)

```javascript
// Solo usuarios autenticados pueden conectarse
this.wss.on('connection', (ws, req) => {
  const token = extractToken(req);
  const user = verifyToken(token);
  const origin = req.headers.origin;
  const ip = req.socket.remoteAddress;

  // Múltiples capas de seguridad
  if (!token) return ws.close(1008, 'Token requerido');
  if (!user) return ws.close(1008, 'Token inválido');
  if (!isOriginAllowed(origin)) return ws.close(1008, 'Origen no permitido');
  if (!rateLimiter.isAllowed(ip)) return ws.close(1008, 'Rate limit');
  if (exceedsUserLimit(user.id)) return ws.close(1008, 'Límite de conexiones');

  this.clients.set(ws, { userId: user.id, username: user.username });
});

// Cliente
const token = await login(username, password);
const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
// Solo conecta si está autenticado
```

**Protecciones:**
- ✅ Autenticación JWT
- ✅ Validación de origen
- ✅ Rate limiting
- ✅ Límite de conexiones por usuario
- ✅ Heartbeat (detecta conexiones muertas)
- ✅ Sanitización de datos

---

## Mejores Prácticas para Producción

### 1. Usar HTTPS/WSS (No HTTP/WS)

```javascript
// ❌ NUNCA en producción
const ws = new WebSocket('ws://mi-app.com');

// ✅ SIEMPRE usar WSS (WebSocket Secure)
const ws = new WebSocket('wss://mi-app.com');
```

```javascript
// Backend con HTTPS
import https from 'https';
import fs from 'fs';

const server = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem')
}, app);

const wss = new WebSocketServer({ server });
```

### 2. Implementar Roles y Permisos

```javascript
// No todos los usuarios deben recibir todos los eventos
broadcast(eventType, data, requiredRole = null) {
  this.clients.forEach((metadata, ws) => {
    // Verificar rol
    if (requiredRole && metadata.role !== requiredRole) {
      return; // Saltar este cliente
    }

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: eventType, data }));
    }
  });
}

// Uso:
// Solo administradores reciben eventos de costos
websocketService.broadcast('PRODUCT_COST_UPDATED', data, 'admin');
```

### 3. Logging y Monitoreo

```javascript
// Registrar todas las conexiones y eventos
logger.info('WebSocket connection', {
  userId: metadata.userId,
  ip: req.socket.remoteAddress,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});

// Alertas de seguridad
if (failedAuthAttempts > 5) {
  alertSecurityTeam(`Múltiples intentos de conexión fallidos desde ${ip}`);
}
```

### 4. Timeout de Inactividad

```javascript
// Desconectar usuarios inactivos después de 1 hora
this.clients.forEach((metadata, ws) => {
  const inactiveTime = Date.now() - metadata.lastActivity;

  if (inactiveTime > 3600000) { // 1 hora
    ws.close(1000, 'Sesión expirada por inactividad');
    this.clients.delete(ws);
  }
});
```

### 5. Validación de Mensajes

```javascript
ws.on('message', (message) => {
  try {
    const data = JSON.parse(message);

    // Validar estructura
    if (!data.type || typeof data.type !== 'string') {
      return ws.close(1008, 'Mensaje inválido');
    }

    // Whitelist de tipos permitidos
    const allowedTypes = ['PING', 'SUBSCRIBE', 'UNSUBSCRIBE'];
    if (!allowedTypes.includes(data.type)) {
      return ws.close(1008, 'Tipo de mensaje no permitido');
    }

    // Sanitizar
    const sanitized = sanitizeInput(data);

    handleMessage(sanitized);
  } catch (error) {
    logger.error('Error procesando mensaje:', error);
    ws.close(1008, 'Error procesando mensaje');
  }
});
```

### 6. Limitar Tamaño de Mensajes

```javascript
const MAX_MESSAGE_SIZE = 1024 * 10; // 10KB

this.wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    if (message.length > MAX_MESSAGE_SIZE) {
      logger.warn('Mensaje demasiado grande rechazado');
      ws.close(1009, 'Mensaje demasiado grande');
      return;
    }
    // ... procesar mensaje
  });
});
```

---

## Checklist de Seguridad para Producción

### Autenticación y Autorización
- [ ] Implementar autenticación JWT
- [ ] Validar tokens en cada conexión
- [ ] Implementar refresh tokens
- [ ] Verificar roles y permisos
- [ ] Expirar sesiones automáticamente

### Protección contra Ataques
- [ ] Validar origen (CORS)
- [ ] Implementar rate limiting por IP
- [ ] Limitar conexiones por usuario
- [ ] Proteger contra CSWSH
- [ ] Usar WSS (no WS) en producción

### Datos y Mensajes
- [ ] Sanitizar todos los datos antes de enviar
- [ ] Eliminar información sensible
- [ ] Validar estructura de mensajes
- [ ] Limitar tamaño de mensajes
- [ ] Encriptar datos sensibles

### Monitoreo y Mantenimiento
- [ ] Implementar heartbeat/ping-pong
- [ ] Detectar y cerrar conexiones zombies
- [ ] Logging de eventos de seguridad
- [ ] Alertas de intentos de intrusión
- [ ] Métricas de uso y rendimiento

### Infraestructura
- [ ] Usar HTTPS/WSS
- [ ] Certificados SSL válidos
- [ ] Firewall configurado
- [ ] Proxy reverso (nginx/apache)
- [ ] Balanceo de carga para escalabilidad

---

## Conclusión

### El Código Actual

✅ **Perfecto para aprendizaje y desarrollo local**
❌ **NO usar en producción sin implementar seguridad**

### ¿Es Peligroso?

**En desarrollo local:** No, es seguro para aprender.

**En producción:** SÍ, muy peligroso sin las medidas de seguridad.

### Próximos Pasos

1. Implementar autenticación JWT
2. Agregar validación de origen
3. Implementar rate limiting
4. Usar WSS en producción
5. Sanitizar todos los datos
6. Monitorear conexiones activas
7. Documentar políticas de seguridad

### Regla de Oro

> **"Nunca confíes en el cliente. Valida, autentica y sanitiza TODO en el servidor."**

---

## Recursos Adicionales

- [OWASP WebSocket Security](https://owasp.org/www-community/vulnerabilities/WebSocket_Security)
- [RFC 6455 - WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)


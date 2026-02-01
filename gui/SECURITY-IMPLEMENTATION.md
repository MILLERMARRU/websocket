# 🔐 Guía de Implementación de Seguridad

## Resumen

Este documento explica cómo migrar del código educativo (inseguro) al código seguro para producción.

---

## 📁 Archivos Creados

### Nuevos Archivos de Seguridad

1. **`src/middlewares/auth.js`**
   - Autenticación JWT
   - Middlewares para proteger rutas HTTP
   - Verificación de roles

2. **`src/services/websocket.service.secure.js`**
   - Versión segura del WebSocketService
   - Autenticación obligatoria
   - Rate limiting
   - Validación de origen
   - Heartbeat y detección de conexiones muertas
   - Sanitización de datos

3. **`src/routes/auth.routes.js`**
   - Endpoints de login, logout, verify
   - Generación de tokens JWT

4. **`.env.secure.example`**
   - Variables de entorno para producción

---

## 🚀 Migración Paso a Paso

### Paso 1: Instalar Dependencias

```bash
# Instalar jsonwebtoken
npm install jsonwebtoken

# Verificar instalación
npm list jsonwebtoken
```

### Paso 2: Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.secure.example .env

# Generar un secreto JWT fuerte
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Editar .env y reemplazar JWT_SECRET con el secreto generado
```

**Ejemplo de .env para producción:**
```env
JWT_SECRET=Kx9mP2nR5tY8wZ1aB4cD7eF0gH3iJ6kL9mN2pQ5rS8tU1vW4xY7zA0bC3dE6fG9h
JWT_EXPIRES_IN=24h
WS_MAX_CONNECTIONS_PER_IP=10
WS_MAX_CONNECTIONS_PER_USER=5
ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
```

### Paso 3: Usar WebSocketService Seguro

**Opción A: Reemplazar el archivo actual**

```bash
# Hacer backup del original
cp src/services/websocket.service.js src/services/websocket.service.insecure.js

# Copiar la versión segura
cp src/services/websocket.service.secure.js src/services/websocket.service.js
```

**Opción B: Importar la versión segura directamente**

Editar `src/app.js`:

```javascript
// Cambiar esta línea:
// import { WebSocketService } from './services/websocket.service.js';

// Por esta:
import { SecureWebSocketService as WebSocketService } from './services/websocket.service.secure.js';
```

### Paso 4: Agregar Rutas de Autenticación

Editar `src/app.js`:

```javascript
import { createAuthRoutes } from './routes/auth.routes.js';

// En setupRoutes():
setupRoutes() {
  // Health check
  this.app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      websocketClients: this.websocketService.getConnectedClientsCount()
    });
  });

  // ✅ NUEVO: Rutas de autenticación
  this.app.use('/auth', createAuthRoutes());

  // Rutas de productos
  this.app.use('/api/productos', createProductRoutes(this.productController));
}
```

### Paso 5: Proteger Rutas HTTP (Opcional)

Si quieres que solo usuarios autenticados puedan acceder al API:

```javascript
// src/routes/product.routes.js
import { authenticateHTTP, requireRole } from '../middlewares/auth.js';

export const createProductRoutes = (productController) => {
  const router = express.Router();

  // Aplicar autenticación a todas las rutas
  router.use(authenticateHTTP);

  // GET /api/productos - Todos los usuarios autenticados
  router.get('/', (req, res, next) => {
    productController.getAllProducts(req, res, next);
  });

  // POST /api/productos - Solo admins
  router.post('/', requireRole('admin'), validateBody, (req, res, next) => {
    productController.createProduct(req, res, next);
  });

  // PUT /api/productos/:id - Solo admins
  router.put('/:id', requireRole('admin'), validateId, validateBody, (req, res, next) => {
    productController.updateProduct(req, res, next);
  });

  // DELETE /api/productos/:id - Solo admins
  router.delete('/:id', requireRole('admin'), validateId, (req, res, next) => {
    productController.deleteProduct(req, res, next);
  });

  return router;
};
```

### Paso 6: Actualizar Cliente HTML

Editar `client-example.html`:

```javascript
// ===== AGREGAR AL INICIO DEL SCRIPT =====

let currentToken = null;
let currentUser = null;

// Función de login
async function login() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (result.success) {
      currentToken = result.token;
      currentUser = result.user;

      // Guardar en localStorage
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));

      // Conectar WebSocket
      connectWebSocket(result.token);

      // Ocultar form de login, mostrar app
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    console.error('Error en login:', error);
    alert('Error al conectar con el servidor');
  }
}

// Modificar connectWebSocket para recibir token
function connectWebSocket(token) {
  // Agregar token como query parameter
  ws = new WebSocket(`ws://localhost:3000?token=${token}`);

  ws.onopen = () => {
    console.log('✅ Conectado (autenticado)');
    connectionStatus.textContent = '✅ Conectado al WebSocket';
    connectionStatus.className = 'connection-status connected';
    addEventToLog('Conexión establecida', 'info');
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };

  ws.onclose = (event) => {
    console.log('Desconectado:', event.code, event.reason);
    connectionStatus.textContent = '❌ Desconectado';
    connectionStatus.className = 'connection-status disconnected';

    // Si el token expiró (código 1008), pedir login
    if (event.code === 1008) {
      alert('Sesión expirada. Por favor inicia sesión nuevamente.');
      logout();
    } else {
      // Reconectar con el mismo token
      addEventToLog('Conexión cerrada. Reconectando...', 'info');
      setTimeout(() => {
        const token = localStorage.getItem('token');
        if (token) {
          connectWebSocket(token);
        }
      }, 3000);
    }
  };

  ws.onerror = (error) => {
    console.error('Error WebSocket:', error);
  };
}

// Función de logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentToken = null;
  currentUser = null;

  if (ws) {
    ws.close();
  }

  // Mostrar form de login
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('app').style.display = 'none';
}

// Al cargar la página, verificar si hay token guardado
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');

  if (token) {
    const user = JSON.parse(localStorage.getItem('user'));
    currentToken = token;
    currentUser = user;

    // Intentar conectar
    connectWebSocket(token);

    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  } else {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('app').style.display = 'none';
  }
});

// Actualizar fetch para incluir token en headers
async function createProduct(productData) {
  const response = await fetch('http://localhost:3000/api/productos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}` // ✅ Agregar token
    },
    body: JSON.stringify(productData)
  });

  return response.json();
}
```

### Paso 7: Agregar HTML de Login

Agregar al HTML antes del contenedor principal:

```html
<!-- Formulario de Login -->
<div id="loginForm" style="display: none;">
  <div class="container" style="max-width: 400px; margin-top: 100px;">
    <h1>🔐 Iniciar Sesión</h1>

    <div class="form-group">
      <label>Usuario:</label>
      <input type="text" id="loginUsername" placeholder="admin o user">
    </div>

    <div class="form-group">
      <label>Contraseña:</label>
      <input type="password" id="loginPassword" placeholder="admin123 o user123">
    </div>

    <button onclick="login()">Iniciar Sesión</button>

    <div style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 4px;">
      <strong>Usuarios de prueba:</strong><br>
      Usuario: <code>admin</code> / Contraseña: <code>admin123</code><br>
      Usuario: <code>user</code> / Contraseña: <code>user123</code>
    </div>
  </div>
</div>

<!-- App principal (oculta hasta login) -->
<div id="app" style="display: none;">
  <!-- El contenido actual va aquí -->
</div>
```

---

## 🧪 Pruebas

### Probar Autenticación

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Respuesta:
# {
#   "success": true,
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { "id": 1, "username": "admin", "role": "admin" }
# }

# 2. Guardar el token y usarlo
export TOKEN="el-token-que-recibiste"

# 3. Acceder a rutas protegidas
curl http://localhost:3000/api/productos \
  -H "Authorization: Bearer $TOKEN"

# 4. Probar WebSocket con token (desde navegador)
const ws = new WebSocket('ws://localhost:3000?token=el-token-que-recibiste');
```

### Probar Seguridad

```bash
# 1. Intentar conectar sin token (debe fallar)
const ws = new WebSocket('ws://localhost:3000');
# Resultado: Conexión cerrada con código 1008

# 2. Intentar con token inválido (debe fallar)
const ws = new WebSocket('ws://localhost:3000?token=token-falso');
# Resultado: Conexión cerrada con código 1008

# 3. Abrir muchas conexiones (debe aplicar rate limiting)
for (let i = 0; i < 20; i++) {
  new WebSocket('ws://localhost:3000?token=token-valido');
}
# Resultado: Las primeras 5 conectan, las demás son rechazadas
```

---

## 📊 Comparación

| Característica | Código Original | Código Seguro |
|----------------|----------------|---------------|
| Autenticación | ❌ No | ✅ JWT obligatorio |
| Validación de origen | ❌ No | ✅ CORS configurado |
| Rate limiting | ❌ No | ✅ Por IP y por usuario |
| Heartbeat | ❌ No | ✅ Cada 30 segundos |
| Sanitización de datos | ❌ No | ✅ Automática |
| Límite de conexiones | ❌ No | ✅ 5 por usuario, 10 por IP |
| Detección de inactividad | ❌ No | ✅ 1 hora timeout |
| Logging de seguridad | ⚠️ Básico | ✅ Completo |

---

## ✅ Checklist de Producción

Antes de desplegar a producción:

- [ ] Cambiar `JWT_SECRET` a un valor fuerte y único
- [ ] Configurar `ALLOWED_ORIGINS` con dominios reales
- [ ] Usar WSS (WebSocket Secure) en vez de WS
- [ ] Configurar HTTPS con certificados SSL
- [ ] Implementar base de datos real para usuarios (no hardcoded)
- [ ] Hash de contraseñas con bcrypt
- [ ] Logging a archivo o servicio externo (no solo console)
- [ ] Monitoreo de intentos de intrusión
- [ ] Backup automático de base de datos
- [ ] Rate limiting a nivel de nginx/proxy
- [ ] Firewall configurado
- [ ] Pruebas de penetración

---

## 🎓 Conceptos Aprendidos

1. **JWT (JSON Web Tokens)**: Autenticación stateless
2. **Rate Limiting**: Prevención de ataques DoS
3. **Heartbeat/Ping-Pong**: Detección de conexiones muertas
4. **Sanitización**: Eliminar datos sensibles
5. **CORS**: Validación de orígenes
6. **Roles y permisos**: Control de acceso granular

---

## 📚 Recursos Adicionales

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP WebSocket Security](https://owasp.org/www-community/vulnerabilities/WebSocket_Security)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)


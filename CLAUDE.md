# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Server Management
```bash
# Start server in production mode
npm start

# Start server in development mode with auto-reload
npm run dev

# Start PostgreSQL database
docker compose up -d

# View database logs
docker compose logs -f

# Stop database
docker compose down

# Stop and remove all data
docker compose down -v
```

### Database Access
```bash
# Connect to PostgreSQL
docker exec -it productos_db psql -U admin -d productos_db

# Run queries directly
docker exec -it productos_db psql -U admin -d productos_db -c "SELECT * FROM productos;"
```

### Testing the API
```bash
# Health check
curl http://localhost:3000/health

# Get all products
curl http://localhost:3000/api/productos

# Create product
curl -X POST http://localhost:3000/api/productos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test","precio":10,"stock":5}'

# Update product
curl -X PUT http://localhost:3000/api/productos/1 \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Updated","precio":20,"stock":10}'

# Delete product
curl -X DELETE http://localhost:3000/api/productos/1
```

### WebSocket Testing
Open `client-example.html` in a browser to test WebSocket real-time events.

## Architecture Overview

This is a Node.js backend implementing SOLID principles with a layered architecture:

```
HTTP Request → Routes → Middlewares → Controller → Service → Repository → PostgreSQL
                                            ↓
                                     WebSocket Service → Connected Clients
```

### Layer Responsibilities

**Models (`src/models/`)**: Data structure definition and validation logic
- `Product.validate()`: Validates product data before persistence
- `Product.sanitize()`: Cleans and normalizes input data

**Repositories (`src/repositories/`)**: Database access layer (persistence)
- Direct interaction with PostgreSQL via the database pool
- CRUD operations return Model instances
- No business logic - pure data access

**Services (`src/services/`)**: Business logic layer
- `ProductService`: Orchestrates validation, sanitization, and repository calls
- `WebSocketService`: Manages WebSocket connections and broadcasts events
- Services depend on repositories (Dependency Inversion)

**Controllers (`src/controllers/`)**: HTTP request handling
- Parse request parameters and body
- Call appropriate service methods
- Trigger WebSocket events after successful write operations
- Delegate error handling to middleware

**Routes (`src/routes/`)**: Endpoint definitions
- Map HTTP methods and paths to controller methods
- Apply validation middleware

**Middlewares (`src/middlewares/`)**: Cross-cutting concerns
- `validator.js`: Validates request parameters (ID, body)
- `errorHandler.js`: Centralizes error handling and HTTP responses

**Config (`src/config/`)**: Application configuration
- `database.js`: PostgreSQL connection pool
- `env.js`: Environment variables centralization

### Key Design Decisions

**Single Source of Truth**: All write operations (POST, PUT, DELETE) happen via HTTP REST API. WebSocket is read-only for real-time notifications.

**Event Flow**:
1. Client sends HTTP request
2. Controller processes request via Service
3. Service validates and persists via Repository
4. Controller emits WebSocket event on success
5. All connected WebSocket clients receive real-time notification

**Dependency Injection**: Services and controllers receive dependencies through constructors, making them testable and following Dependency Inversion Principle.

**Database Connection**: Uses a connection pool (pg.Pool) for efficient PostgreSQL access. The pool manages connections automatically.

## Adding New Features

### Adding a New Endpoint to Products

1. Add method to `ProductService` (business logic)
2. Add method to `ProductController` (HTTP handling)
3. Register route in `createProductRoutes()` in `product.routes.js`
4. Add validation middleware if needed in `validator.js`

### Adding a New Entity (e.g., Categories)

Follow the same layered structure:

1. Create `category.model.js` in `src/models/` (validation, sanitization)
2. Create `category.repository.js` in `src/repositories/` (DB operations)
3. Create `category.service.js` in `src/services/` (business logic)
4. Create `category.controller.js` in `src/controllers/` (HTTP handlers)
5. Create `category.routes.js` in `src/routes/` (endpoint mapping)
6. Register routes in `src/app.js`
7. Add WebSocket events if needed in `websocket.service.js`
8. Create migration SQL in `init.sql` or separate migration file

### Adding New WebSocket Events

1. Add event emitter method in `WebSocketService` class:
```javascript
emitCustomEvent(data) {
  this.broadcast('CUSTOM_EVENT', data);
}
```

2. Inject WebSocketService into controller
3. Call `this.websocketService.emitCustomEvent(data)` after operation

## Database Schema

The `productos` table includes:
- `id`: Auto-incrementing primary key
- `nombre`: Required, max 255 chars
- `descripcion`: Optional text
- `precio`: Required decimal, must be >= 0
- `stock`: Integer >= 0, default 0
- `created_at`: Auto-set timestamp
- `updated_at`: Auto-updated via trigger

The `updated_at` field is automatically updated through a PostgreSQL trigger (`update_productos_updated_at`).

## Error Handling Strategy

Errors bubble up through layers:
1. Repository throws database errors
2. Service catches, logs, and re-throws with business context
3. Controller passes errors to next() middleware
4. `errorHandler` middleware formats and sends HTTP response

Error types:
- Validation errors: Include `validationErrors` array, return 400
- Not found: Return 404
- Database constraint violations: Return 400
- Unknown errors: Return 500

## Environment Variables

All configuration in `.env` file. Copy from `.env.example` if missing.

Critical variables:
- `PORT`: HTTP server port (default: 3000)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: PostgreSQL connection
- `NODE_ENV`: Affects error verbosity (development/production)

## SOLID Principles Applied

**Single Responsibility**: Each class has one reason to change
- ProductRepository: Only changes if data access logic changes
- ProductService: Only changes if business rules change
- ProductController: Only changes if HTTP interface changes

**Open/Closed**: Open for extension, closed for modification
- WebSocketService can emit new event types without changing existing code
- Routes are configured via factory functions

**Liskov Substitution**: Dependencies can be replaced by implementations of their interface
- ProductService accepts any repository implementing the expected methods

**Interface Segregation**: Small, specific interfaces
- Each middleware handles one concern
- Each service method does one thing

**Dependency Inversion**: High-level modules depend on abstractions
- Controllers depend on Service interface, not implementation
- Services depend on Repository interface, not PostgreSQL directly

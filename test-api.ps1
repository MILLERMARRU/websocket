# Script de prueba para el API REST de productos (PowerShell)
# Uso: .\test-api.ps1

$API_URL = "http://localhost:3000/api/productos"
$BASE_URL = "http://localhost:3000"

Write-Host "🧪 Iniciando pruebas del API REST" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Health Check
Write-Host "1️⃣ Health Check" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
$response | ConvertTo-Json -Depth 10
Write-Host ""

# GET - Obtener todos los productos
Write-Host "2️⃣ GET - Obtener todos los productos" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri $API_URL -Method Get
$response | ConvertTo-Json -Depth 10
Write-Host ""

# POST - Crear nuevo producto
Write-Host "3️⃣ POST - Crear nuevo producto" -ForegroundColor Yellow
$body = @{
    nombre = "Producto de Prueba"
    descripcion = "Creado desde script de prueba"
    precio = 99.99
    stock = 25
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 10

$PRODUCT_ID = $response.data.id
Write-Host "`n✅ Producto creado con ID: $PRODUCT_ID" -ForegroundColor Green
Write-Host ""

# GET - Obtener producto específico
Write-Host "4️⃣ GET - Obtener producto por ID ($PRODUCT_ID)" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$API_URL/$PRODUCT_ID" -Method Get
$response | ConvertTo-Json -Depth 10
Write-Host ""

# PUT - Actualizar producto
Write-Host "5️⃣ PUT - Actualizar producto" -ForegroundColor Yellow
$body = @{
    nombre = "Producto Actualizado"
    descripcion = "Descripción modificada"
    precio = 149.99
    stock = 10
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$API_URL/$PRODUCT_ID" -Method Put -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 10
Write-Host ""

# DELETE - Eliminar producto
Write-Host "6️⃣ DELETE - Eliminar producto" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$API_URL/$PRODUCT_ID" -Method Delete
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Verificar eliminación
Write-Host "7️⃣ Verificar eliminación (debería dar error 404)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/$PRODUCT_ID" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Error esperado: Producto no encontrado (404)" -ForegroundColor Red
}
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ Pruebas completadas" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Consejo: Abre client-example.html en tu navegador" -ForegroundColor Cyan
Write-Host "   para ver las notificaciones WebSocket en tiempo real" -ForegroundColor Cyan

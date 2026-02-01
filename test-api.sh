#!/bin/bash

# Script de prueba para el API REST de productos
# Uso: ./test-api.sh

API_URL="http://localhost:3000/api/productos"
BASE_URL="http://localhost:3000"

echo "🧪 Iniciando pruebas del API REST"
echo "=================================="
echo ""

# Health Check
echo "1️⃣ Health Check"
curl -s $BASE_URL/health | json_pp
echo -e "\n"

# GET - Obtener todos los productos
echo "2️⃣ GET - Obtener todos los productos"
curl -s $API_URL | json_pp
echo -e "\n"

# POST - Crear nuevo producto
echo "3️⃣ POST - Crear nuevo producto"
RESPONSE=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Producto de Prueba",
    "descripcion": "Creado desde script de prueba",
    "precio": 99.99,
    "stock": 25
  }')
echo $RESPONSE | json_pp

# Extraer ID del producto creado (requiere jq)
if command -v jq &> /dev/null; then
    PRODUCT_ID=$(echo $RESPONSE | jq -r '.data.id')
    echo -e "\n✅ Producto creado con ID: $PRODUCT_ID"
else
    echo -e "\n⚠️  Instala 'jq' para pruebas automáticas: npm install -g json"
    PRODUCT_ID=1
fi
echo -e "\n"

# GET - Obtener producto específico
echo "4️⃣ GET - Obtener producto por ID ($PRODUCT_ID)"
curl -s $API_URL/$PRODUCT_ID | json_pp
echo -e "\n"

# PUT - Actualizar producto
echo "5️⃣ PUT - Actualizar producto"
curl -s -X PUT $API_URL/$PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Producto Actualizado",
    "descripcion": "Descripción modificada",
    "precio": 149.99,
    "stock": 10
  }' | json_pp
echo -e "\n"

# DELETE - Eliminar producto
echo "6️⃣ DELETE - Eliminar producto"
curl -s -X DELETE $API_URL/$PRODUCT_ID | json_pp
echo -e "\n"

# Verificar eliminación
echo "7️⃣ Verificar eliminación (debería dar error 404)"
curl -s $API_URL/$PRODUCT_ID | json_pp
echo -e "\n"

echo "=================================="
echo "✅ Pruebas completadas"
echo ""
echo "💡 Consejo: Abre client-example.html en tu navegador"
echo "   para ver las notificaciones WebSocket en tiempo real"

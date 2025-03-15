#\!/bin/bash

echo "Iniciando Gestionador..."

# Verificar si MongoDB está instalado
if \! command -v mongod &> /dev/null; then
    echo "Error: MongoDB no está instalado o no se encuentra en el PATH"
    echo "Por favor instala MongoDB antes de continuar."
    exit 1
fi

# Crear directorio para datos de MongoDB si no existe
MONGO_DATA_DIR=~/data/db
if [ \! -d "$MONGO_DATA_DIR" ]; then
    echo "Creando directorio para datos de MongoDB..."
    mkdir -p "$MONGO_DATA_DIR"
fi

# Iniciar MongoDB en segundo plano
echo "Iniciando MongoDB..."
mongod --dbpath "$MONGO_DATA_DIR" --fork --logpath "$MONGO_DATA_DIR/mongodb.log"

if [ $? -ne 0 ]; then
    echo "Error al iniciar MongoDB. Verifica que el servicio no esté ya en ejecución."
    echo "Si MongoDB ya está ejecutándose, puedes continuar con el resto del script."
else
    echo "MongoDB iniciado correctamente."
fi

# Cambiar al directorio del backend
cd "$(dirname "$0")/backend"

# Verificar si las dependencias están instaladas
if [ \! -d "node_modules" ]; then
    echo "Instalando dependencias del backend..."
    npm install
fi

# Crear usuario administrador (solo una vez)
echo "Creando usuario administrador si no existe..."
NODE_ENV=development node ./scripts/create-admin.js

# Iniciar el backend en segundo plano
echo "Iniciando servidor backend..."
npm run dev &
BACKEND_PID=$\!

# Cambiar al directorio del frontend
cd ../frontend

# Verificar si las dependencias están instaladas
if [ \! -d "node_modules" ]; then
    echo "Instalando dependencias del frontend..."
    npm install
fi

# Iniciar el frontend en segundo plano
echo "Iniciando servidor frontend..."
npm start &
FRONTEND_PID=$\!

echo ""
echo "¡Gestionador está en funcionamiento\!"
echo "Backend: http://localhost:5001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Credenciales de administrador:"
echo "Email: ivan.zarate@minseg.gob.ar"
echo "Contraseña: Minseg2025-"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios."

# Manejar la terminación del script
trap "echo 'Deteniendo servicios...'; kill $BACKEND_PID $FRONTEND_PID; mongo admin --eval 'db.shutdownServer()' > /dev/null 2>&1; echo 'Servicios detenidos.'" EXIT

# Mantener el script en ejecución
wait

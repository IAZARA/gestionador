#!/bin/bash

# Variables de entorno para el backend
cat > /var/www/gestionador/backend/.env << EOF
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://localhost:27017/gestionador
JWT_SECRET=your_secret_key_change_in_production
JWT_EXPIRATION=1d
FILE_STORAGE_PATH=uploads/
EOF

# Verificar que MongoDB está funcionando
echo "Verificando que MongoDB esté funcionando..."
if systemctl is-active --quiet mongod; then
  echo "MongoDB está activo y funcionando."
else
  echo "MongoDB no está funcionando. Intentando iniciarlo..."
  sudo systemctl start mongod
  sudo systemctl enable mongod
  
  if systemctl is-active --quiet mongod; then
    echo "MongoDB iniciado correctamente."
  else
    echo "Error: No se pudo iniciar MongoDB. Verifica la instalación."
    exit 1
  fi
fi

echo "Verificando la restauración de la base de datos..."
echo "Se asume que la base de datos fue restaurada en pasos anteriores."

# Desplegar el backend
cd /var/www/gestionador/backend
npm install

# Verificar si existe el script build
if grep -q "\"build\"" package.json; then
  echo "Ejecutando npm build..."
  npm run build
  
  # Verificar si existe dist/index.js
  if [ -f "dist/index.js" ]; then
    echo "Archivo dist/index.js encontrado. Iniciando con PM2..."
    pm2 start dist/index.js --name gestionador-backend
  else
    echo "Archivo dist/index.js no encontrado. Buscando el archivo principal..."
    MAIN_FILE=$(grep -o '"main":\s*"[^"]*"' package.json | cut -d'"' -f4)
    
    if [ -n "$MAIN_FILE" ] && [ -f "$MAIN_FILE" ]; then
      echo "Iniciando $MAIN_FILE con PM2..."
      pm2 start $MAIN_FILE --name gestionador-backend
    else
      echo "Intentando iniciar index.js en la raíz..."
      if [ -f "index.js" ]; then
        pm2 start index.js --name gestionador-backend
      else
        echo "No se encontró un archivo válido para iniciar. Verifica la estructura del backend."
        exit 1
      fi
    fi
  fi
else
  echo "No se encontró script 'build' en package.json."
  echo "Intentando iniciar la aplicación directamente..."
  
  # Buscar archivo principal en package.json
  MAIN_FILE=$(grep -o '"main":\s*"[^"]*"' package.json | cut -d'"' -f4)
  
  if [ -n "$MAIN_FILE" ] && [ -f "$MAIN_FILE" ]; then
    echo "Iniciando $MAIN_FILE con PM2..."
    pm2 start $MAIN_FILE --name gestionador-backend
  else
    echo "Intentando iniciar index.js en la raíz..."
    if [ -f "index.js" ]; then
      pm2 start index.js --name gestionador-backend
    else
      echo "No se encontró un archivo válido para iniciar. Verifica la estructura del backend."
      exit 1
    fi
  fi
fi

# Desplegar el frontend
cd /var/www/gestionador/frontend
npm install
npm run build

# Reiniciar PM2 y Nginx
pm2 save
sudo systemctl restart nginx

echo "Aplicación desplegada correctamente"
echo "La aplicación estará disponible en: http://dngbds.online/login" 
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

# Verificar si existen usuarios en la base de datos
echo "Verificando la base de datos de usuarios..."
USERS_COUNT=$(mongo --quiet gestionador --eval "db.users.count()" || echo "0")

if [ "$USERS_COUNT" != "0" ]; then
  echo "Se encontraron $USERS_COUNT usuarios en la base de datos."
  echo "Los datos de usuarios están listos para la aplicación."
else
  echo "No se encontraron usuarios en la base de datos."
  echo "Es posible que haya habido un problema con la restauración de la base de datos local."
  echo "Verifica que el script de restauración se ejecutó correctamente."
fi

# Desplegar el backend
cd /var/www/gestionador/backend
npm install
npm run build
pm2 start dist/index.js --name gestionador-backend

# Desplegar el frontend
cd /var/www/gestionador/frontend
npm install
npm run build

# Reiniciar PM2 y Nginx
pm2 save
sudo systemctl restart nginx

echo "Aplicación desplegada correctamente"
echo "La aplicación estará disponible en: http://dngbds.online/login" 
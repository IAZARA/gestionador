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
echo "Verifica que todo funcione accediendo a http://tu-ip-o-dominio" 
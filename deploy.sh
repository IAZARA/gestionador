#!/bin/bash

# Actualizar el sistema
sudo apt update
sudo apt upgrade -y

# Instalar Node.js y npm
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Instalar Nginx
sudo apt install -y nginx

# Instalar PM2
sudo npm install -g pm2

# Crear directorios necesarios
sudo mkdir -p /var/www/gestionador
sudo chown -R $USER:$USER /var/www/gestionador

# Configurar Nginx
sudo tee /etc/nginx/sites-available/gestionador << EOF
server {
    listen 80;
    server_name dngbds.online www.dngbds.online;

    # Frontend
    location / {
        root /var/www/gestionador/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Habilitar el sitio
sudo ln -s /etc/nginx/sites-available/gestionador /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Configurar firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable

echo "La configuración del servidor está completa."
echo "Ahora puedes desplegar tu aplicación en /var/www/gestionador" 
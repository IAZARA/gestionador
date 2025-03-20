#!/bin/bash

# Script para preparar un droplet para una nueva instalación
# Ejecutar como usuario con privilegios de sudo

echo "Preparando el droplet para una nueva instalación..."

# Actualizar el sistema
echo "Actualizando el sistema..."
sudo apt update
sudo apt upgrade -y

# Instalar Node.js y npm (versión 18 en lugar de 16)
echo "Instalando Node.js 18 y npm..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación de Node.js
echo "Versión de Node.js instalada:"
node -v
echo "Versión de npm instalada:"
npm -v

# Instalar MongoDB
echo "Instalando MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Verificar que MongoDB está funcionando
echo "Estado de MongoDB:"
sudo systemctl status mongod --no-pager

# Restaurar respaldo de la base de datos si existe
if [ -d "/root/backups" ]; then
  echo "Buscando respaldos de MongoDB..."
  LATEST_BACKUP=$(find /root/backups -name "mongodb_backup_*" -type d | sort -r | head -n 1)
  
  if [ ! -z "$LATEST_BACKUP" ]; then
    echo "Encontrado respaldo de MongoDB: $LATEST_BACKUP"
    echo "Restaurando la base de datos de usuarios..."
    sudo mongorestore --db gestionador $LATEST_BACKUP/gestionador
    echo "Base de datos restaurada exitosamente."
  else
    echo "No se encontraron respaldos de MongoDB."
  fi
else
  echo "No se encontró el directorio de respaldos."
fi

# Instalar los clientes de MongoDB para comandos como mongo
echo "Instalando clientes de MongoDB..."
sudo apt install -y mongodb-clients

# Instalar Nginx
echo "Instalando Nginx..."
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verificar que Nginx está funcionando
echo "Estado de Nginx:"
sudo systemctl status nginx --no-pager

# Instalar PM2
echo "Instalando PM2..."
sudo npm install -g pm2

# Configurar firewall
echo "Configurando firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Crear directorios para la aplicación
echo "Creando directorios para la aplicación..."
sudo mkdir -p /var/www/gestionador/frontend
sudo mkdir -p /var/www/gestionador/backend
sudo chown -R $USER:$USER /var/www/gestionador

echo "El droplet ha sido preparado exitosamente para la instalación de la aplicación."
echo "Directorios creados en /var/www/gestionador/"
if [ ! -z "$LATEST_BACKUP" ]; then
  echo "Los datos de los usuarios han sido restaurados de $LATEST_BACKUP"
fi 
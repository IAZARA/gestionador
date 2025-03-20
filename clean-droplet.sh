#!/bin/bash

# Script para limpiar completamente un droplet de DigitalOcean
# Ejecutar como usuario con privilegios de sudo

echo "Iniciando limpieza completa del droplet..."

# Crear un directorio de respaldo si no existe
echo "Verificando directorio para respaldos..."
sudo mkdir -p /root/backups

# Hacer respaldo de la base de datos MongoDB actual (si existe)
if systemctl is-active --quiet mongod; then
  echo "Haciendo respaldo de la base de datos MongoDB actual..."
  # Fecha actual para el nombre del archivo
  BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
  
  # Crear respaldo de la base de datos de usuarios
  echo "Respaldando la base de datos gestionador actual..."
  sudo mongodump --db gestionador --out /root/backups/mongodb_backup_$BACKUP_DATE
  
  echo "Respaldo actual creado en /root/backups/mongodb_backup_$BACKUP_DATE"
fi

# Detener y eliminar servicios existentes
echo "Deteniendo servicios..."
if command -v pm2 &> /dev/null; then
  pm2 kill
  sudo npm uninstall -g pm2
fi

if systemctl is-active --quiet nginx; then
  echo "Deteniendo y desinstalando Nginx..."
  sudo systemctl stop nginx
  sudo systemctl disable nginx
  sudo apt-get remove --purge -y nginx nginx-common nginx-full
fi

if systemctl is-active --quiet mongod; then
  echo "Deteniendo y desinstalando MongoDB..."
  sudo systemctl stop mongod
  sudo systemctl disable mongod
  sudo apt-get remove --purge -y mongodb-org*
fi

# Limpiar directorios de aplicaciones anteriores
echo "Eliminando directorios de aplicaciones anteriores..."
sudo rm -rf /var/www/*

# Limpiar configuraciones de Nginx
echo "Limpiando configuraciones de Nginx..."
sudo rm -rf /etc/nginx/sites-available/*
sudo rm -rf /etc/nginx/sites-enabled/*

# Eliminar repositorios externos
echo "Eliminando repositorios externos..."
sudo rm -f /etc/apt/sources.list.d/*

# Actualizar la lista de paquetes
echo "Actualizando lista de paquetes..."
sudo apt-get update

# Limpiar paquetes no utilizados
echo "Limpiando paquetes no utilizados..."
sudo apt-get autoremove -y
sudo apt-get clean

echo "El droplet ha sido limpiado completamente."
echo "Los respaldos de la base de datos se conservan en /root/backups/"
echo "Ahora puedes proceder con la instalación de tu aplicación." 
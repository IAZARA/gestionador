#!/bin/bash

# Dirección IP del droplet
DROPLET_IP="67.205.150.107"

# Verifica si se proporcionó un usuario
if [ -z "$1" ]; then
  echo "Por favor, proporciona el nombre de usuario para SSH."
  echo "Uso: ./deploy-to-droplet.sh <usuario>"
  exit 1
fi

SSH_USER="$1"

# Directorios locales
FRONTEND_DIR="./frontend"
BACKEND_DIR="./backend"

# Verificar si los directorios existen
if [ ! -d "$FRONTEND_DIR" ] || [ ! -d "$BACKEND_DIR" ]; then
  echo "Error: No se encuentran los directorios frontend y/o backend."
  exit 1
fi

# Exportar la base de datos local
echo "Exportando la base de datos local..."
./export-local-db.sh

# Verificar si la exportación fue exitosa
if [ $? -ne 0 ]; then
  echo "Falló la exportación de la base de datos local. Abortando despliegue."
  exit 1
fi

# Obtener la ruta del backup más reciente
LATEST_BACKUP=$(find ./db_backup -name "mongodb_backup_*" -type d | sort -r | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "No se encontró el respaldo de la base de datos. Abortando despliegue."
  exit 1
fi

echo "Se utilizará el respaldo: $LATEST_BACKUP"

# Crear directorio remoto para el respaldo
ssh ${SSH_USER}@${DROPLET_IP} "sudo mkdir -p /root/backups"

# Copiar el respaldo al droplet
echo "Copiando respaldo de la base de datos al droplet..."
scp -r $LATEST_BACKUP ${SSH_USER}@${DROPLET_IP}:/tmp/local_backup

# Mover el respaldo al directorio de backups en el servidor
ssh ${SSH_USER}@${DROPLET_IP} "sudo cp -r /tmp/local_backup /root/backups/"

echo "Copiando archivos del frontend al droplet..."
rsync -avz --progress $FRONTEND_DIR/ ${SSH_USER}@${DROPLET_IP}:/var/www/gestionador/frontend/

echo "Copiando archivos del backend al droplet..."
rsync -avz --progress $BACKEND_DIR/ ${SSH_USER}@${DROPLET_IP}:/var/www/gestionador/backend/

# Crear un script modificado que use el respaldo local
cat > restore-local-db.sh << EOF
#!/bin/bash

# Restaurar la base de datos local
echo "Restaurando la base de datos desde el respaldo local..."
sudo mongorestore --db gestionador --drop /root/backups/local_backup/gestionador

# Verificar si la restauración fue exitosa
if [ \$? -eq 0 ]; then
  echo "Base de datos restaurada exitosamente."
else
  echo "Error al restaurar la base de datos."
  exit 1
fi
EOF

# Copiar el script de restauración al droplet
echo "Copiando script de restauración al droplet..."
scp restore-local-db.sh ${SSH_USER}@${DROPLET_IP}:/tmp/

# Ejecutar el script de restauración
ssh ${SSH_USER}@${DROPLET_IP} "chmod +x /tmp/restore-local-db.sh && sudo /tmp/restore-local-db.sh"

echo "Copiando script de despliegue mejorado al droplet..."
scp deploy-app-with-users.sh ${SSH_USER}@${DROPLET_IP}:/tmp/

echo "Ejecutando el script de despliegue en el droplet..."
ssh ${SSH_USER}@${DROPLET_IP} "chmod +x /tmp/deploy-app-with-users.sh && cd /var/www/gestionador && sudo /tmp/deploy-app-with-users.sh"

echo "Configurando Nginx..."
scp nginx-config.conf ${SSH_USER}@${DROPLET_IP}:/tmp/
ssh ${SSH_USER}@${DROPLET_IP} "sudo cp /tmp/nginx-config.conf /etc/nginx/sites-available/gestionador && sudo ln -sf /etc/nginx/sites-available/gestionador /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl restart nginx"

echo "Despliegue completado. La aplicación debería estar disponible en http://dngbds.online/login" 
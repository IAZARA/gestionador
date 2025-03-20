#!/bin/bash

# Script todo-en-uno para limpiar, preparar y desplegar la aplicación 
# usando la base de datos local

# Verificar si se proporcionó un usuario
if [ -z "$1" ]; then
  echo "Por favor, proporciona el nombre de usuario para SSH."
  echo "Uso: ./deploy-with-local-db.sh <usuario>"
  exit 1
fi

SSH_USER="$1"
DROPLET_IP="67.205.150.107"

# 1. Exportar la base de datos local
echo "==== PASO 1: Exportando la base de datos local ===="
./export-local-db.sh

if [ $? -ne 0 ]; then
  echo "Error al exportar la base de datos local. Abortando."
  exit 1
fi

# Obtener la ruta del backup local más reciente
LATEST_BACKUP=$(find ./db_backup -name "mongodb_backup_*" -type d | sort -r | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "No se encontró el respaldo de la base de datos. Abortando."
  exit 1
fi

echo "Se utilizará el respaldo local: $LATEST_BACKUP"

# 2. Copiar scripts al droplet
echo "==== PASO 2: Copiando scripts al droplet ===="
scp clean-droplet.sh prepare-droplet.sh ${SSH_USER}@${DROPLET_IP}:/tmp/

# 3. Limpiar el droplet
echo "==== PASO 3: Limpiando el droplet ===="
ssh ${SSH_USER}@${DROPLET_IP} "chmod +x /tmp/clean-droplet.sh && sudo /tmp/clean-droplet.sh"

# 4. Preparar el droplet
echo "==== PASO 4: Preparando el droplet ===="
ssh ${SSH_USER}@${DROPLET_IP} "chmod +x /tmp/prepare-droplet.sh && sudo /tmp/prepare-droplet.sh"

# 5. Copiar el respaldo de la base de datos al droplet
echo "==== PASO 5: Copiando respaldo de la base de datos al droplet ===="
ssh ${SSH_USER}@${DROPLET_IP} "sudo mkdir -p /root/backups/local_backup"
scp -r $LATEST_BACKUP/gestionador ${SSH_USER}@${DROPLET_IP}:/tmp/local_backup
ssh ${SSH_USER}@${DROPLET_IP} "sudo cp -r /tmp/local_backup /root/backups/"

# 6. Restaurar la base de datos local en el droplet
echo "==== PASO 6: Restaurando la base de datos local en el droplet ===="

# Crear script de restauración
cat > restore-local-db.sh << EOF
#!/bin/bash
echo "Restaurando la base de datos desde el respaldo local..."
sudo mongorestore --db gestionador --drop /root/backups/local_backup
if [ \$? -eq 0 ]; then
  echo "Base de datos restaurada exitosamente."
else
  echo "Error al restaurar la base de datos."
  exit 1
fi
EOF

# Copiar y ejecutar el script de restauración
scp restore-local-db.sh ${SSH_USER}@${DROPLET_IP}:/tmp/
ssh ${SSH_USER}@${DROPLET_IP} "chmod +x /tmp/restore-local-db.sh && sudo /tmp/restore-local-db.sh"

# 7. Copiar los archivos de la aplicación
echo "==== PASO 7: Copiando archivos de la aplicación ===="
echo "Copiando archivos del frontend..."
rsync -avz --progress frontend/ ${SSH_USER}@${DROPLET_IP}:/var/www/gestionador/frontend/

echo "Copiando archivos del backend..."
rsync -avz --progress backend/ ${SSH_USER}@${DROPLET_IP}:/var/www/gestionador/backend/

# 8. Desplegar la aplicación
echo "==== PASO 8: Desplegando la aplicación ===="
scp deploy-app-with-users.sh ${SSH_USER}@${DROPLET_IP}:/tmp/
ssh ${SSH_USER}@${DROPLET_IP} "chmod +x /tmp/deploy-app-with-users.sh && cd /var/www/gestionador && sudo /tmp/deploy-app-with-users.sh"

# 9. Configurar Nginx
echo "==== PASO 9: Configurando Nginx ===="
scp nginx-config.conf ${SSH_USER}@${DROPLET_IP}:/tmp/
ssh ${SSH_USER}@${DROPLET_IP} "sudo cp /tmp/nginx-config.conf /etc/nginx/sites-available/gestionador && sudo ln -sf /etc/nginx/sites-available/gestionador /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl restart nginx"

echo "==== DESPLIEGUE COMPLETADO ===="
echo "La aplicación está disponible en http://dngbds.online/login"
echo "Los usuarios de tu base de datos local han sido restaurados en el droplet." 
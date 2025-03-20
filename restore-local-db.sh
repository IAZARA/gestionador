#!/bin/bash

# Verificar que MongoDB está instalado e iniciado
if ! systemctl is-active --quiet mongod; then
  echo "MongoDB no está activo. Intentando iniciarlo..."
  sudo systemctl start mongod
  sleep 5
  
  if ! systemctl is-active --quiet mongod; then
    echo "Error: No se pudo iniciar MongoDB. Verifica la instalación."
    exit 1
  fi
  
  echo "MongoDB iniciado correctamente."
fi

echo "Verificando que existan los archivos de respaldo..."
if [ ! -d "/root/backups/local_backup" ]; then
  echo "Error: No se encuentra el directorio de respaldo en /root/backups/local_backup"
  echo "Buscando otros posibles respaldos..."
  
  BACKUP=$(find /root/backups -type d -name "*backup*" | head -n 1)
  if [ -z "$BACKUP" ]; then
    echo "No se encontraron respaldos. Abortando."
    exit 1
  fi
  
  echo "Se encontró el respaldo: $BACKUP"
  echo "Usando este respaldo en su lugar."
  BACKUP_PATH=$BACKUP
else
  BACKUP_PATH="/root/backups/local_backup"
fi

echo "Restaurando la base de datos desde el respaldo..."
sudo mongorestore --db gestionador --drop $BACKUP_PATH

# Verificar el resultado de la restauración
if [ $? -eq 0 ]; then
  echo "Base de datos restaurada exitosamente."
  
  # Crear un usuario de prueba si la colección de usuarios está vacía
  # Este paso es opcional y solo para verificar que la base de datos funciona
  USER_COUNT=$(mongo --quiet --eval 'db.getSiblingDB("gestionador").users.count()' 2>/dev/null || echo "error")
  
  if [ "$USER_COUNT" = "0" ] || [ "$USER_COUNT" = "error" ]; then
    echo "No se encontraron usuarios en la base de datos."
    echo "Esto puede ser normal si tu base de datos local no tenía usuarios."
  else
    echo "Se encontraron $USER_COUNT usuarios en la base de datos restaurada."
  fi
else
  echo "Error al restaurar la base de datos."
  echo "Verifica que los archivos de respaldo son válidos y que MongoDB tiene permisos adecuados."
  exit 1
fi

#!/bin/bash

# Crear directorio para el respaldo
mkdir -p ./db_backup

# Fecha para el nombre del archivo
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")

echo "Exportando base de datos local..."

# Realizar el respaldo de la base de datos local
mongodump --db gestionador --out ./db_backup/mongodb_backup_$BACKUP_DATE

if [ $? -eq 0 ]; then
  echo "Base de datos exportada exitosamente a ./db_backup/mongodb_backup_$BACKUP_DATE"
  echo "Este respaldo será utilizado para restaurar los usuarios en el droplet."
else
  echo "Error al exportar la base de datos local."
  exit 1
fi 
#!/bin/bash

# Dirección IP del droplet
DROPLET_IP="67.205.150.107"

# Verifica si se proporcionó un usuario
if [ -z "$1" ]; then
  echo "Por favor, proporciona el nombre de usuario para SSH."
  echo "Uso: ./connect-and-clean.sh <usuario>"
  exit 1
fi

SSH_USER="$1"

echo "Copiando los scripts al droplet..."
scp clean-droplet.sh prepare-droplet.sh ${SSH_USER}@${DROPLET_IP}:/tmp/

echo "Conectando al droplet y ejecutando el script de limpieza..."
ssh ${SSH_USER}@${DROPLET_IP} "chmod +x /tmp/clean-droplet.sh && sudo /tmp/clean-droplet.sh"

echo "¿Deseas también preparar el droplet para una nueva instalación? (s/n)"
read respuesta

if [ "$respuesta" = "s" ] || [ "$respuesta" = "S" ]; then
  echo "Preparando el droplet para una nueva instalación..."
  ssh ${SSH_USER}@${DROPLET_IP} "chmod +x /tmp/prepare-droplet.sh && sudo /tmp/prepare-droplet.sh"
  echo "Preparación completa. El droplet está listo para recibir la aplicación."
else
  echo "El droplet ha sido limpiado pero no preparado."
fi 
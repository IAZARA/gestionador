# Gestionador

Sistema de gestión de proyectos completo con tablero Kanban, gestión de usuarios, tareas, documentos y más.

## Instrucciones para la instalación

### Requisitos previos

- Node.js (v14 o superior)
- MongoDB (v4 o superior)
- npm o yarn

### Instalación del Backend

1. Navega a la carpeta del backend:
   ```bash
   cd backend
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura el archivo .env:
   ```
   NODE_ENV=development
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/gestionador
   JWT_SECRET=your_secret_key_change_in_production
   JWT_EXPIRATION=1d
   FILE_STORAGE_PATH=uploads/
   ```

4. Inicia el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```

### Instalación del Frontend

1. Navega a la carpeta del frontend:
   ```bash
   cd frontend
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el servidor de desarrollo:
   ```bash
   npm start
   ```

## Script de Inicio Rápido

Puedes usar el siguiente script para iniciar rápidamente tanto el backend como el frontend en dos terminales diferentes:

```bash
#\!/bin/bash

# Iniciar MongoDB en primer plano
mongod --dbpath ~/data/db &

# Crear el usuario administrador (solo una vez)
cd backend
NODE_ENV=development node ./scripts/create-admin.js

# Iniciar el backend
npm run dev &

# Iniciar el frontend
cd ../frontend
npm start &

echo "Gestionador está en funcionamiento"
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Credenciales de administrador:"
echo "Email: ivan.zarate@minseg.gob.ar"
echo "Contraseña: Minseg2025-"
```

## Credenciales de Administrador

- Email: ivan.zarate@minseg.gob.ar
- Contraseña: Minseg2025-

## Características principales

- Sistema de roles y permisos: Administrador, Gestor, Usuario
- Gestión de usuarios con áreas de expertise: Administrativo, Técnico, Legal
- Tablero Kanban para gestión visual de tareas
- Wiki colaborativa por proyecto
- Sistema de notificaciones en tiempo real
- Calendario y planificación de eventos
- Gestión de licencias de personal
- Repositorio documental centralizado
- Generación de informes y análisis

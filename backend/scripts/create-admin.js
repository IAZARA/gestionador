const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectDB = require('../src/config/db');
const config = require('../src/config/config');

// Configuración del usuario administrador
const adminUser = {
  firstName: 'Ivan',
  lastName: 'Zarate',
  email: 'ivan.zarate@minseg.gob.ar',
  password: 'Minseg2025-',
  role: 'admin',
  expertiseArea: 'administrative',
  department: 'Administración',
  position: 'Administrador Principal',
  isActive: true
};

// Función para crear el usuario administrador
const createAdmin = async () => {
  try {
    // Conectar a la base de datos
    await connectDB();
    
    // Verificar si ya existe un usuario con ese email
    const existingUser = await User.findOne({ email: adminUser.email });
    
    if (existingUser) {
      console.log(`El usuario administrador con email ${adminUser.email} ya existe.`);
      process.exit(0);
    }
    
    // Crear el usuario administrador
    const user = new User(adminUser);
    await user.save();
    
    console.log(`¡Usuario administrador creado exitosamente!`);
    console.log(`Email: ${adminUser.email}`);
    console.log(`Contraseña: ${adminUser.password}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error al crear el usuario administrador:', error.message);
    process.exit(1);
  }
};

// Ejecutar la función
createAdmin();
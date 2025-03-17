const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/config');
const { logger } = require('../utils/logger');

// Función para conectar a la base de datos
const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('MongoDB conectado...');
  } catch (err) {
    logger.error('Error al conectar a MongoDB:', err.message);
    process.exit(1);
  }
};

// Función para hacer administrador a un usuario por email
const makeAdmin = async (email) => {
  try {
    // Buscar el usuario por email
    const user = await User.findOne({ email });
    
    if (!user) {
      logger.error(`Usuario con email ${email} no encontrado`);
      process.exit(1);
    }
    
    // Actualizar el rol a admin
    user.role = 'admin';
    await user.save();
    
    logger.info(`Usuario ${user.firstName} ${user.lastName} (${email}) ahora es administrador`);
    return user;
  } catch (err) {
    logger.error('Error al actualizar el usuario:', err.message);
    process.exit(1);
  }
};

// Ejecutar el script
const run = async () => {
  await connectDB();
  
  const email = 'ivan.zarate@minseg.gob.ar';
  await makeAdmin(email);
  
  // Desconectar de la base de datos
  mongoose.disconnect();
  logger.info('Desconectado de MongoDB');
};

run();

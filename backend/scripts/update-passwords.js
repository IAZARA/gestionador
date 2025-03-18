const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectDB = require('../src/config/db');

// Contraseñas por defecto para cada usuario
const defaultPasswords = {
  'hernan.salvatore@minseg.gob.ar': 'Minseg2025-',
  'ricardo.stasi@minseg.gob.ar': 'Minseg2025-',
  'maxi.scarimbolo@minseg.gob.ar': 'Minseg2025-',
  'sofi.varela@minseg.gob.ar': 'Minseg2025-'
};

const updatePasswords = async () => {
  try {
    await connectDB();
    
    for (const [email, password] of Object.entries(defaultPasswords)) {
      const user = await User.findOne({ email });
      if (user) {
        user.password = password;
        await user.save();
        console.log(`Contraseña actualizada para ${email}`);
      } else {
        console.log(`Usuario no encontrado: ${email}`);
      }
    }
    
    console.log('Proceso completado');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updatePasswords(); 
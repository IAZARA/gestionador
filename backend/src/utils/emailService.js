const nodemailer = require('nodemailer');
const config = require('../config/config');

// Crear transportador de email con la configuración del archivo config
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.auth.user,
    pass: config.email.auth.pass
  }
});

// Función para enviar correos electrónicos
const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    // Configuración del correo
    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      html,
      attachments
    };

    // Enviar el correo
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Error al enviar correo electrónico:', error);
    throw error;
  }
};

// Plantillas de correos electrónicos

// Bienvenida al nuevo usuario
const sendWelcomeEmail = async (user) => {
  const subject = 'Bienvenido a Gestionador';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">¡Bienvenido a Gestionador!</h2>
      <p>Hola ${user.firstName},</p>
      <p>Tu cuenta ha sido creada exitosamente. Ahora puedes acceder a todas las herramientas de gestión de proyectos que ofrecemos.</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Usuario:</strong> ${user.email}</p>
      </div>
      <p>Si tienes alguna pregunta, no dudes en contactar al administrador del sistema.</p>
      <a href="${config.appUrl}/login" style="display: inline-block; background-color: #3498db; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 20px;">Iniciar Sesión</a>
      <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">Este es un correo automático, por favor no responder.</p>
    </div>
  `;
  
  return await sendEmail(user.email, subject, html);
};

// Restablecimiento de contraseña
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${config.appUrl}/reset-password/${resetToken}`;
  const subject = 'Restablecimiento de Contraseña - Gestionador';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">Restablecimiento de Contraseña</h2>
      <p>Hola ${user.firstName},</p>
      <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Para completar el proceso, haz clic en el siguiente enlace:</p>
      <a href="${resetUrl}" style="display: inline-block; background-color: #3498db; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin: 20px 0;">Restablecer Contraseña</a>
      <p>Este enlace expirará en 1 hora por seguridad.</p>
      <p>Si no solicitaste este cambio, puedes ignorar este correo y tu contraseña seguirá siendo la misma.</p>
      <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">Este es un correo automático, por favor no responder.</p>
    </div>
  `;
  
  return await sendEmail(user.email, subject, html);
};

// Notificación de asignación a proyecto
const sendProjectAssignmentEmail = async (user, project) => {
  const subject = `Has sido asignado al proyecto: ${project.name}`;
  const projectUrl = `${config.appUrl}/projects/${project._id}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">Asignación a Proyecto</h2>
      <p>Hola ${user.firstName},</p>
      <p>Has sido asignado al proyecto: <strong>${project.name}</strong></p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Descripción:</strong> ${project.description}</p>
        <p><strong>Fecha de inicio:</strong> ${new Date(project.startDate).toLocaleDateString('es-ES')}</p>
        <p><strong>Fecha de finalización:</strong> ${new Date(project.endDate).toLocaleDateString('es-ES')}</p>
      </div>
      <p>Puedes ver más detalles del proyecto haciendo clic en el siguiente enlace:</p>
      <a href="${projectUrl}" style="display: inline-block; background-color: #3498db; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px;">Ver Proyecto</a>
      <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">Este es un correo automático, por favor no responder.</p>
    </div>
  `;
  
  return await sendEmail(user.email, subject, html);
};

// Notificación de asignación de tarea
const sendTaskAssignmentEmail = async (user, task, project) => {
  const subject = `Nueva tarea asignada: ${task.title}`;
  const taskUrl = `${config.appUrl}/projects/${project._id}/tasks/${task._id}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">Nueva Tarea Asignada</h2>
      <p>Hola ${user.firstName},</p>
      <p>Se te ha asignado una nueva tarea en el proyecto <strong>${project.name}</strong>:</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Tarea:</strong> ${task.title}</p>
        <p><strong>Descripción:</strong> ${task.description}</p>
        <p><strong>Prioridad:</strong> ${task.priority}</p>
        <p><strong>Fecha límite:</strong> ${new Date(task.dueDate).toLocaleDateString('es-ES')}</p>
      </div>
      <p>Puedes ver los detalles de la tarea haciendo clic en el siguiente enlace:</p>
      <a href="${taskUrl}" style="display: inline-block; background-color: #3498db; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px;">Ver Tarea</a>
      <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">Este es un correo automático, por favor no responder.</p>
    </div>
  `;
  
  return await sendEmail(user.email, subject, html);
};

// Notificación de plazo próximo
const sendDeadlineReminderEmail = async (user, tasks) => {
  const subject = 'Recordatorio de tareas con plazos próximos';
  
  // Generar lista HTML de tareas
  let tasksHtml = '';
  tasks.forEach(task => {
    const taskUrl = `${config.appUrl}/projects/${task.project._id}/tasks/${task._id}`;
    tasksHtml += `
      <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
        <p><strong>Tarea:</strong> ${task.title}</p>
        <p><strong>Proyecto:</strong> ${task.project.name}</p>
        <p><strong>Fecha límite:</strong> ${new Date(task.dueDate).toLocaleDateString('es-ES')}</p>
        <a href="${taskUrl}" style="display: inline-block; font-size: 12px; background-color: #3498db; color: white; text-decoration: none; padding: 5px 10px; border-radius: 3px;">Ver Tarea</a>
      </div>
    `;
  });
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">Recordatorio de Plazos Próximos</h2>
      <p>Hola ${user.firstName},</p>
      <p>Tienes las siguientes tareas con plazos próximos:</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        ${tasksHtml}
      </div>
      <a href="${config.appUrl}/dashboard" style="display: inline-block; background-color: #3498db; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px;">Ir al Dashboard</a>
      <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">Este es un correo automático, por favor no responder.</p>
    </div>
  `;
  
  return await sendEmail(user.email, subject, html);
};

// Notificación de aprobación/rechazo de licencia
const sendLeaveStatusEmail = async (user, leave) => {
  const status = leave.status === 'approved' ? 'aprobada' : 'rechazada';
  const subject = `Solicitud de licencia ${status}`;
  const dashboardUrl = `${config.appUrl}/dashboard/leaves`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">Actualización de Solicitud de Licencia</h2>
      <p>Hola ${user.firstName},</p>
      <p>Tu solicitud de licencia ha sido <strong>${status}</strong>.</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Tipo de licencia:</strong> ${leave.leaveType}</p>
        <p><strong>Período:</strong> ${new Date(leave.startDate).toLocaleDateString('es-ES')} al ${new Date(leave.endDate).toLocaleDateString('es-ES')}</p>
        <p><strong>Días:</strong> ${leave.dayCount}</p>
        ${leave.comments ? `<p><strong>Comentarios:</strong> ${leave.comments}</p>` : ''}
      </div>
      <a href="${dashboardUrl}" style="display: inline-block; background-color: #3498db; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px;">Ver Mis Licencias</a>
      <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">Este es un correo automático, por favor no responder.</p>
    </div>
  `;
  
  return await sendEmail(user.email, subject, html);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendProjectAssignmentEmail,
  sendTaskAssignmentEmail,
  sendDeadlineReminderEmail,
  sendLeaveStatusEmail
};
const nodemailer = require("nodemailer");

// Crear transportador de correo
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * Enviar correo de confirmación al usuario
 * @param {string} correoUsuario
 * @param {number} idTicket
 * @param {string} nombreContacto
 * @param {string} descripcionProblema
 * @param {string} nombreDepartamento
 * @returns {Promise}
 */

/* Correo confirmacion ticket */
async function enviarConfirmacionTicket(
  correoUsuario,
  idTicket,
  nombreContacto,
  descripcionProblema,
  nombreDepartamento,
) {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .header { background-color: #007bff; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; }
            .ticket-info { background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; }
            .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
            strong { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Ticket Registrado</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${nombreContacto}</strong>,</p>
              <p>Tu ticket ha sido registrado exitosamente en nuestro sistema. Aquí están los detalles:</p>
              
              <div class="ticket-info">
                <p><strong>Número de Ticket:</strong> #${idTicket}</p>
                <p><strong>Departamento:</strong> ${nombreDepartamento}</p>
                <p><strong>Estado:</strong> Abierto</p>
                <p><strong>Fecha de Creación:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <div class="ticket-info">
                <p><strong>Descripción del Problema:</strong></p>
                <p>${descripcionProblema}</p>
              </div>

              <p>Nuestro equipo de soporte ha recibido tu solicitud y se pondrá en contacto contigo pronto.</p>
              <p>Para cualquier consulta sobre tu ticket, referencia el número <strong>#${idTicket}</strong>.</p>
              
              <p>Saludos cordiales,<br><strong>Equipo de Soporte</strong></p>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático. Por favor no respondas a este correo.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: correoUsuario,
      subject: `Ticket #${idTicket} - Confirmación de Registro`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✓ Correo enviado al usuario (${correoUsuario}):`,
      info.messageId,
    );
    return info;
  } catch (error) {
    console.error("X Error al enviar correo al usuario:", error);
    throw error;
  }
}

/* Correo confirmacion ticket finalizado */
/**
 * Enviar correo de confirmación al usuario
 * @param {string} correoUsuario
 * @param {number} idTicket
 * @param {string} nombreContacto
 * @param {string} descripcionProblema
 * @param {string} nombreDepartamento
 * @param {string} Estado
 * @returns {Promise}
 */

async function enviarTicketFinalizado(
  correoUsuario,
  idTicket,
  nombreContacto,
  descripcionProblema,
  nombreDepartamento,
  Estado,
) {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .header { background-color: #007bff; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; }
            .ticket-info { background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; }
            .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
            strong { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Ticket Terminado</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${nombreContacto}</strong>,</p>
              <p>Tu ticket ha sido terminado exitosamente en nuestro sistema. Aquí están los detalles:</p>
              
              <div class="ticket-info">
                <p><strong>Número de Ticket:</strong> #${idTicket}</p>
                <p><strong>Departamento:</strong> ${nombreDepartamento}</p>
                <p><strong>Estado:</strong> ${Estado}</p>
                <p><strong>Fecha de Creación:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <div class="ticket-info">
                <p><strong>Descripción del Problema:</strong></p>
                <p>${descripcionProblema}</p>
              </div>

              <p>Nuestro equipo de soporte ha atendido tu ticket y se ha cerrado correctamente.</p>
              
              
              <p>Saludos cordiales,<br><strong>Equipo de Soporte</strong></p>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático. Por favor no respondas a este correo.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✓ Correo enviado al usuario (${correoUsuario}):`,
      info.messageId,
    );
    return info;
  } catch (error) {
    console.error("X Error al enviar correo al usuario:", error);
    throw error;
  }
}

/**
 * Enviar notificación al correo de soporte
 * @param {number} idTicket
 * @param {string} nombreContacto
 * @param {string} correoContacto
 * @param {string} descripcionProblema
 * @param {string} nombreDepartamento
 * @returns {Promise}
 */
async function enviarNotificacionSoporte(
  idTicket,
  nombreContacto,
  correoContacto,
  descripcionProblema,
  nombreDepartamento,
) {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .header { background-color: #28a745; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; }
            .ticket-info { background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #28a745; }
            .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
            strong { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎫 Nuevo Ticket Asignado</h1>
            </div>
            <div class="content">
              <p>Un nuevo ticket ha sido registrado en el sistema. Detalles:</p>
              
              <div class="ticket-info">
                <p><strong>Número de Ticket:</strong> #${idTicket}</p>
                <p><strong>Departamento:</strong> ${nombreDepartamento}</p>
                <p><strong>Estado:</strong> Abierto</p>
                <p><strong>Fecha de Creación:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <div class="ticket-info">
                <h3>Información del Contacto:</h3>
                <p><strong>Nombre:</strong> ${nombreContacto}</p>
                <p><strong>Correo:</strong> ${correoContacto}</p>
              </div>

              <div class="ticket-info">
                <p><strong>Descripción del Problema:</strong></p>
                <p>${descripcionProblema}</p>
              </div>

              <p>Por favor, revisa este ticket y toma las acciones necesarias.</p>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático del Sistema de Tickets.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: process.env.SUPPORT_EMAIL,
      subject: `[NUEVO TICKET] #${idTicket} - ${nombreDepartamento}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✓ Correo enviado a soporte (${process.env.SUPPORT_EMAIL}):`,
      info.messageId,
    );
    return info;
  } catch (error) {
    console.error("X Error al enviar correo a soporte:", error);
    throw error;
  }
}

/**
 * Verificar conexión de correo
 * @returns {Promise}
 */
async function verificarConexion() {
  try {
    await transporter.verify();
    console.log("✓ Conexión SMTP verificada correctamente");
    return true;
  } catch (error) {
    console.error("X Error en la conexión SMTP:", error);
    return false;
  }
}

module.exports = {
  enviarConfirmacionTicket,
  enviarTicketFinalizado,
  enviarNotificacionSoporte,
  verificarConexion,
};

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendBookingConfirmation = async (booking, restaurant) => {
  const emailContent = `
    <h2>Confirmación de Reserva - ${restaurant.name}</h2>
    <p>Estimado/a ${booking.customerName},</p>
    <p>Su reserva ha sido confirmada con los siguientes detalles:</p>
    <ul>
      <li>Código de confirmación: ${booking.confirmationCode}</li>
      <li>Fecha: ${new Date(booking.date).toLocaleDateString()}</li>
      <li>Hora: ${booking.time}</li>
      <li>Número de personas: ${booking.guests}</li>
      <li>Restaurante: ${restaurant.name}</li>
      <li>Dirección: ${restaurant.address}</li>
    </ul>
    ${booking.specialRequests ? `<p>Peticiones especiales: ${booking.specialRequests}</p>` : ''}
    <p>Si necesita modificar o cancelar su reserva, por favor contacte con nosotros proporcionando su código de confirmación.</p>
    <p>¡Gracias por elegirnos!</p>
  `;

  try {
    await transporter.sendMail({
      from: `"${restaurant.name}" <${process.env.EMAIL_FROM}>`,
      to: booking.customerEmail,
      subject: `Confirmación de Reserva - ${restaurant.name}`,
      html: emailContent,
    });
    console.log(`Confirmation email sent to ${booking.customerEmail}`);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw error;
  }
};

module.exports = {
  transporter,
  sendBookingConfirmation,
};

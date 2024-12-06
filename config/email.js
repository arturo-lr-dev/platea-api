const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

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
  // Generate QR code with booking details
  const qrData = JSON.stringify({
    confirmationCode: booking.confirmationCode,
    restaurantName: restaurant.name,
    date: booking.date,
    time: booking.time,
    guests: booking.guests
  });
  
  // Generate QR code as Buffer
  const qrCodeBuffer = await QRCode.toBuffer(qrData);

  const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmación de Reserva</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 30px 0;
          background: #f8f8f8;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .restaurant-name {
          font-size: 28px;
          color: #1a1a1a;
          margin: 0;
          font-weight: 600;
        }
        .confirmation-code {
          background: #2d3748;
          color: #ffffff;
          padding: 15px 25px;
          border-radius: 6px;
          font-size: 24px;
          font-family: monospace;
          letter-spacing: 2px;
          margin: 20px 0;
          text-align: center;
        }
        .details {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 25px;
          margin: 20px 0;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        .detail-item {
          padding: 10px;
          background: #f7fafc;
          border-radius: 4px;
        }
        .detail-label {
          font-size: 14px;
          color: #718096;
          margin-bottom: 5px;
        }
        .detail-value {
          font-size: 16px;
          color: #2d3748;
          font-weight: 500;
        }
        .qr-section {
          text-align: center;
          margin: 30px 0;
        }
        .qr-code {
          width: 200px;
          height: 200px;
          margin: 20px auto;
        }
        .special-requests {
          background: #fffbeb;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          text-align: center;
          color: #718096;
          font-size: 14px;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
        .button {
          display: inline-block;
          background: #4a5568;
          color: white;
          padding: 12px 25px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="restaurant-name">${restaurant.name}</h1>
        <p style="color: #666; margin-top: 10px;">Confirmación de Reserva</p>
      </div>

      <p style="font-size: 18px;">Estimado/a ${booking.customerName},</p>
      <p>Su reserva ha sido confirmada exitosamente. A continuación encontrará todos los detalles:</p>

      <div class="confirmation-code">
        ${booking.confirmationCode}
      </div>

      <div class="details">
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">Fecha</div>
            <div class="detail-value">${new Date(booking.date).toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Hora</div>
            <div class="detail-value">${booking.time}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Comensales</div>
            <div class="detail-value">${booking.guests} personas</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Restaurante</div>
            <div class="detail-value">${restaurant.name}</div>
          </div>
        </div>

        <div class="detail-item" style="margin-top: 15px;">
          <div class="detail-label">Dirección</div>
          <div class="detail-value">${restaurant.contact.address}</div>
        </div>
      </div>

      ${booking.specialRequests ? `
        <div class="special-requests">
          <div style="font-weight: 500; margin-bottom: 5px;">Peticiones especiales:</div>
          ${booking.specialRequests}
        </div>
      ` : ''}

      <div class="qr-section">
        <p style="font-weight: 500; color: #2d3748;">Código QR de su reserva</p>
        <p style="color: #718096; font-size: 14px;">Muestre este código al llegar al restaurante</p>
        <img src="cid:qrcode" alt="QR Code" class="qr-code">
      </div>

      <div class="footer">
        <p>Si necesita modificar o cancelar su reserva, por favor contacte con nosotros proporcionando su código de confirmación.</p>
        <p style="margin-top: 20px;">¡Gracias por elegirnos!</p>
        <div style="color: #a0aec0; margin-top: 15px;">
          ${restaurant.name}<br>
          ${restaurant.contact.address}<br>
          ${restaurant.contact.phone}
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"${restaurant.name}" <${process.env.EMAIL_FROM}>`,
      to: booking.customerEmail,
      subject: `Confirmación de Reserva - ${restaurant.name}`,
      html: emailContent,
      attachments: [{
        filename: 'qrcode.png',
        content: qrCodeBuffer,
        cid: 'qrcode'
      }]
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

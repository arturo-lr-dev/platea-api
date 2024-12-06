const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');
const GiftCard = require('../models/GiftCard');
const { sendGiftCardRecipientEmail, sendGiftCardSenderEmail } = require('../config/email');

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, recipientEmail, recipientName, senderEmail, senderName, message } = req.body;

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe expects amounts in cents
      currency: 'eur',
      metadata: {
        type: 'gift_card',
        recipientEmail,
        recipientName,
        senderEmail,
        senderName,
        message
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
});

router.post('/confirm-gift-card', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    // Verify the payment was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'El pago no se ha completado' });
    }

    // Generate gift card code
    const prefix = 'PLATEA';
    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const giftCardCode = `${prefix}-${randomCode}`;

    // Calculate expiry date (1 year from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    // Create gift card in database
    const giftCard = await GiftCard.create({
      code: giftCardCode,
      amount: paymentIntent.amount / 100,
      recipientName: paymentIntent.metadata.recipientName,
      recipientEmail: paymentIntent.metadata.recipientEmail,
      senderName: paymentIntent.metadata.senderName,
      senderEmail: paymentIntent.metadata.senderEmail,
      message: paymentIntent.metadata.message,
      expiryDate,
      stripePaymentIntentId: paymentIntentId
    });

    // Send email to recipient
    await sendGiftCardRecipientEmail({
      recipientEmail: paymentIntent.metadata.recipientEmail,
      recipientName: paymentIntent.metadata.recipientName,
      senderName: paymentIntent.metadata.senderName,
      amount: paymentIntent.amount / 100,
      giftCardCode,
      message: paymentIntent.metadata.message,
      expiryDate
    });

    // Send confirmation email to sender
    await sendGiftCardSenderEmail({
      senderEmail: paymentIntent.metadata.senderEmail,
      recipientName: paymentIntent.metadata.recipientName,
      amount: paymentIntent.amount / 100,
      giftCardCode,
      expiryDate
    });

    res.json({
      success: true,
      giftCardCode,
      amount: paymentIntent.amount / 100,
      metadata: paymentIntent.metadata
    });
  } catch (error) {
    console.error('Error confirming gift card:', error);
    res.status(500).json({ error: 'Error al confirmar el vale regalo' });
  }
});

// Endpoint para verificar un vale regalo
router.get('/verify/:code', async (req, res) => {
  try {
    const giftCard = await GiftCard.findOne({ code: req.params.code });
    
    if (!giftCard) {
      return res.status(404).json({ error: 'Vale regalo no encontrado' });
    }

    if (giftCard.status !== 'active') {
      return res.status(400).json({ error: 'Vale regalo no válido' });
    }

    if (new Date() > giftCard.expiryDate) {
      giftCard.status = 'expired';
      await giftCard.save();
      return res.status(400).json({ error: 'Vale regalo expirado' });
    }

    res.json({
      code: giftCard.code,
      amount: giftCard.amount,
      remainingAmount: giftCard.amount - giftCard.usedAmount,
      expiryDate: giftCard.expiryDate
    });
  } catch (error) {
    console.error('Error verifying gift card:', error);
    res.status(500).json({ error: 'Error al verificar el vale regalo' });
  }
});

// Endpoint para usar un vale regalo
router.post('/redeem', async (req, res) => {
  try {
    const { code, amount } = req.body;
    
    const giftCard = await GiftCard.findOne({ code });
    
    if (!giftCard) {
      return res.status(404).json({ error: 'Vale regalo no encontrado' });
    }

    if (giftCard.status !== 'active') {
      return res.status(400).json({ error: 'Vale regalo no válido' });
    }

    if (new Date() > giftCard.expiryDate) {
      giftCard.status = 'expired';
      await giftCard.save();
      return res.status(400).json({ error: 'Vale regalo expirado' });
    }

    const remainingAmount = giftCard.amount - giftCard.usedAmount;
    if (amount > remainingAmount) {
      return res.status(400).json({ error: 'Saldo insuficiente en el vale regalo' });
    }

    giftCard.usedAmount += amount;
    if (giftCard.usedAmount >= giftCard.amount) {
      giftCard.status = 'used';
    }

    await giftCard.save();

    res.json({
      success: true,
      remainingAmount: giftCard.amount - giftCard.usedAmount,
      status: giftCard.status
    });
  } catch (error) {
    console.error('Error redeeming gift card:', error);
    res.status(500).json({ error: 'Error al usar el vale regalo' });
  }
});

module.exports = router;

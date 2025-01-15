const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');
const GiftCard = require('../models/GiftCard');
const Restaurant = require('../models/Restaurant');
const { sendGiftCardRecipientEmail, sendGiftCardSenderEmail } = require('../config/email');

// List all gift cards with filters
router.get('/all', async (req, res) => {
  try {
    const { name, code, unused, restaurantId } = req.query;
    let query = {};
    
    if (name) {
      query.recipientName = new RegExp(name, 'i');
    }
    
    if (code) {
      query.code = new RegExp(code, 'i');
    }
    
    if (unused === 'true') {
      query.status = 'active';
    }

    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    const giftCards = await GiftCard.find(query).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: giftCards
    });
  } catch (error) {
    console.error('Error fetching gift cards:', error);
    res.status(500).json({ error: 'Error al obtener los vales regalo' });
  }
});

// Mark gift card as used
router.put('/:id/use', async (req, res) => {
  try {
    const { restaurantId } = req.body;
    
    if (!restaurantId) {
      return res.status(400).json({ error: 'Se requiere el ID del restaurante' });
    }

    const giftCard = await GiftCard.findOne({
      _id: req.params.id,
      restaurantId
    });
    
    if (!giftCard) {
      return res.status(404).json({ error: 'Vale regalo no encontrado o no válido para este restaurante' });
    }

    if (giftCard.status !== 'active') {
      return res.status(400).json({ error: 'Vale regalo no válido o ya usado' });
    }

    giftCard.status = 'used';
    giftCard.usedAmount = giftCard.amount;
    await giftCard.save();

    res.json({
      success: true,
      data: giftCard
    });
  } catch (error) {
    console.error('Error marking gift card as used:', error);
    res.status(500).json({ error: 'Error al marcar el vale regalo como usado' });
  }
});

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, recipientEmail, recipientName, senderEmail, senderName, message, restaurantId } = req.body;

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
        message,
        restaurantId
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
    const { paymentIntentId, restaurantId } = req.body;

    // Get restaurant info
    const restaurant = await Restaurant.findOne({ id: restaurantId });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Verify the payment was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'El pago no se ha completado' });
    }

    // Generate gift card code
    const prefix = restaurant.name.substring(0, 3).toUpperCase();
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
      stripePaymentIntentId: paymentIntentId,
      restaurantId
    });

    // Send email to recipient
    await sendGiftCardRecipientEmail({
      recipientEmail: paymentIntent.metadata.recipientEmail,
      recipientName: paymentIntent.metadata.recipientName,
      senderName: paymentIntent.metadata.senderName,
      amount: paymentIntent.amount / 100,
      giftCardCode,
      message: paymentIntent.metadata.message,
      expiryDate,
      restaurant
    });

    // Send confirmation email to sender
    await sendGiftCardSenderEmail({
      senderEmail: paymentIntent.metadata.senderEmail,
      recipientName: paymentIntent.metadata.recipientName,
      amount: paymentIntent.amount / 100,
      giftCardCode,
      expiryDate,
      restaurant
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
    const { restaurantId } = req.query;
    if (!restaurantId) {
      return res.status(400).json({ error: 'Se requiere el ID del restaurante' });
    }

    const giftCard = await GiftCard.findOne({ 
      code: req.params.code,
      restaurantId: restaurantId
    });
    
    if (!giftCard) {
      return res.status(404).json({ error: 'Vale regalo no encontrado o no válido para este restaurante' });
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
    const { code, amount, restaurantId } = req.body;
    
    if (!restaurantId) {
      return res.status(400).json({ error: 'Se requiere el ID del restaurante' });
    }

    const giftCard = await GiftCard.findOne({ 
      code,
      restaurantId
    });
    
    if (!giftCard) {
      return res.status(404).json({ error: 'Vale regalo no encontrado o no válido para este restaurante' });
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

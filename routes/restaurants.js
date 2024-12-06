const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const mockRestaurant = require('../mock/restaurant');

// Get restaurant by ID (mantiene la funcionalidad actual y agrega soporte para MongoDB)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Primero intentamos buscar en la base de datos
    const dbRestaurant = await Restaurant.findOne({ id: id });
    if (dbRestaurant) {
      return res.json(dbRestaurant);
    }
    
    // Si no está en la base de datos y es el restaurante demo, devolvemos el mock
    if (id === mockRestaurant.id) {
      return res.json(mockRestaurant);
    }
    
    res.status(404).json({ error: 'Restaurant not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant availability
router.get('/:id/availability', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const queryDate = new Date(date);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[queryDate.getDay()];

    // Check if it's a special date
    const specialDate = restaurant.bookingConfig.specialDates.find(
      sd => sd.date.toISOString().split('T')[0] === queryDate.toISOString().split('T')[0]
    );

    if (specialDate) {
      return res.json({ timeSlots: specialDate.timeSlots });
    }

    // Return regular schedule for the day
    const regularSchedule = restaurant.bookingConfig.regularSchedule[dayOfWeek];
    res.json({ timeSlots: regularSchedule });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update restaurant booking configuration
router.put('/:id/booking-config', async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    restaurant.bookingConfig = {
      ...restaurant.bookingConfig,
      ...req.body
    };
    
    await restaurant.save();
    res.json(restaurant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update special dates
router.put('/:id/special-dates', async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    restaurant.bookingConfig.specialDates = req.body.specialDates;
    await restaurant.save();
    res.json(restaurant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Manage tables
router.put('/:id/tables', async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    restaurant.bookingConfig.tables = req.body.tables;
    await restaurant.save();
    res.json(restaurant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

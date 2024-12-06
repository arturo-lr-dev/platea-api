const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const Booking = require('../models/Booking');
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

    // Get existing bookings for the date
    const existingBookings = await Booking.find({
      restaurantId: restaurant.id,
      date: {
        $gte: new Date(queryDate.setHours(0,0,0)),
        $lt: new Date(queryDate.setHours(23,59,59))
      },
      status: { $nin: ['cancelled'] }
    });

    // Function to get available tables for a time slot
    const getAvailableTables = (timeSlot, bookings) => {
      const bookingsForSlot = bookings.filter(b => b.time === timeSlot.hour);
      
      // Get all booked table numbers for this time slot
      const bookedTableNumbers = bookingsForSlot.reduce((acc, booking) => {
        return acc.concat(booking.tables || []);
      }, []);

      // Filter available tables
      const availableTables = restaurant.bookingConfig.tables
        .filter(table => 
          table.isActive && !bookedTableNumbers.includes(table.number)
        )
        .map(table => ({
          number: table.number,
          capacity: table.capacity
        }));

      // Calculate total remaining capacity
      const remainingCapacity = availableTables.reduce((sum, table) => sum + table.capacity, 0);

      return {
        hour: timeSlot.hour,
        capacity: remainingCapacity,
        availableTables
      };
    };

    // Check if it's a special date
    const specialDate = restaurant.bookingConfig.specialDates.find(
      sd => sd.date.toISOString().split('T')[0] === queryDate.toISOString().split('T')[0]
    );

    let timeSlots;
    if (specialDate) {
      timeSlots = specialDate.timeSlots.map(slot => 
        getAvailableTables(slot, existingBookings)
      );
    } else {
      timeSlots = restaurant.bookingConfig.regularSchedule[dayOfWeek].map(slot =>
        getAvailableTables(slot, existingBookings)
      );
    }

    res.json({ timeSlots });
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

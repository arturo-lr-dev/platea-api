const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Restaurant = require('../models/Restaurant');
const { sendBookingConfirmation } = require('../config/email');

// Helper function to generate confirmation code
function generateConfirmationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper function to find available tables
async function findAvailableTables(restaurant, date, time, guests, existingBookings) {
  // Get all active tables from the restaurant
  const availableTables = restaurant.bookingConfig.tables.filter(table => table.isActive);
  
  // Get tables that are already booked for this time slot
  const bookedTableNumbers = existingBookings.reduce((acc, booking) => {
    return acc.concat(booking.tables || []);
  }, []);

  // Filter out booked tables and sort by capacity
  const unbootedTables = availableTables
    .filter(table => !bookedTableNumbers.includes(table.number))
    .sort((a, b) => a.capacity - b.capacity);

  // Calculate total available capacity from unbooked tables
  const totalAvailableCapacity = unbootedTables.reduce((sum, table) => sum + table.capacity, 0);
  
  // If total available capacity is less than guests, return null immediately
  if (totalAvailableCapacity < guests) {
    return null;
  }

  // Find the best combination of tables for the guests
  let remainingGuests = guests;
  const selectedTables = [];

  for (const table of unbootedTables) {
    if (remainingGuests <= 0) break;
    
    if (table.capacity <= remainingGuests) {
      selectedTables.push(table.number);
      remainingGuests -= table.capacity;
    }
  }

  // If we couldn't accommodate all guests with smaller tables, try one larger table
  if (remainingGuests > 0) {
    const largerTable = unbootedTables.find(table => table.capacity >= guests);
    if (largerTable) {
      return [largerTable.number];
    }
    return null; // No suitable tables found
  }

  return selectedTables.length > 0 ? selectedTables : null;
}

// Helper function to calculate available capacity
function calculateAvailableCapacity(restaurant, existingBookings) {
  // Get all active tables
  const availableTables = restaurant.bookingConfig.tables.filter(table => table.isActive);
  
  // Get tables that are already booked
  const bookedTableNumbers = existingBookings.reduce((acc, booking) => {
    return acc.concat(booking.tables || []);
  }, []);

  // Calculate total capacity of unbooked tables
  return availableTables
    .filter(table => !bookedTableNumbers.includes(table.number))
    .reduce((sum, table) => sum + table.capacity, 0);
}

// Create a new booking
router.post('/', async (req, res) => {
  try {
    const { restaurantId, date, time, guests } = req.body;
    
    // Validate restaurant exists
    const restaurant = await Restaurant.findOne({ id: restaurantId });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Validate guest count
    const { minGuestsPerBooking, maxGuestsPerBooking } = restaurant.bookingConfig;
    if (guests < minGuestsPerBooking || guests > maxGuestsPerBooking) {
      return res.status(400).json({ 
        error: `Number of guests must be between ${minGuestsPerBooking} and ${maxGuestsPerBooking}` 
      });
    }

    // Check if the requested date is within the allowed booking window
    const bookingDate = new Date(date);
    const today = new Date();
    const daysDifference = Math.ceil((bookingDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysDifference > restaurant.bookingConfig.advanceBookingDays) {
      return res.status(400).json({ 
        error: `Bookings can only be made up to ${restaurant.bookingConfig.advanceBookingDays} days in advance` 
      });
    }

    // Validate if the restaurant is open on the requested date and time
    const dayOfWeek = bookingDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Check if it's a closed day
    if (restaurant.bookingConfig.closedDays.includes(dayOfWeek)) {
      return res.status(400).json({ error: 'Restaurant is closed on this day' });
    }

    // Check if it's a special date
    const specialDate = restaurant.bookingConfig.specialDates.find(
      sd => sd.date.toISOString().split('T')[0] === bookingDate.toISOString().split('T')[0]
    );

    let availableTimeSlot;
    if (specialDate) {
      availableTimeSlot = specialDate.timeSlots.find(slot => slot.hour === time);
    } else {
      availableTimeSlot = restaurant.bookingConfig.regularSchedule[dayOfWeek].find(slot => slot.hour === time);
    }

    if (!availableTimeSlot) {
      return res.status(400).json({ error: 'Selected time slot is not available' });
    }

    // Check existing bookings for the same time slot
    const existingBookings = await Booking.find({
      restaurantId: restaurantId,
      date: {
        $gte: new Date(bookingDate.setHours(0,0,0)),
        $lt: new Date(bookingDate.setHours(23,59,59))
      },
      time: time,
      status: { $nin: ['cancelled'] }
    });

    // Calculate real available capacity based on available tables
    const realAvailableCapacity = calculateAvailableCapacity(restaurant, existingBookings);
    
    if (guests > realAvailableCapacity) {
      return res.status(400).json({ 
        error: 'Not enough available tables for this number of guests',
        availableCapacity: realAvailableCapacity 
      });
    }

    // Find available tables for the booking
    const availableTables = await findAvailableTables(restaurant, date, time, guests, existingBookings);
    if (!availableTables) {
      return res.status(400).json({ 
        error: 'No suitable table combination available for this number of guests',
        availableCapacity: realAvailableCapacity
      });
    }

    // Create the booking with confirmation code and assigned tables
    const booking = new Booking({
      ...req.body,
      restaurantId: restaurant.id,
      confirmationCode: generateConfirmationCode(),
      tables: availableTables
    });
    await booking.save();

    // Send confirmation email
    try {
      await sendBookingConfirmation(booking, restaurant);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Continue with the booking process even if email fails
    }

    res.status(201).json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get booking by confirmation code
router.get('/confirm/:code', async (req, res) => {
  try {
    const booking = await Booking.findOne({ confirmationCode: req.params.code });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const restaurant = await Restaurant.findOne({ id: booking.restaurantId });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json({
      ...booking.toObject(),
      restaurant: {
        name: restaurant.name,
        address: restaurant.contact.address,
        phone: restaurant.contact.phone,
        email: restaurant.contact.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get restaurant bookings for a specific date range
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const restaurant = await Restaurant.findOne({ id: req.params.restaurantId });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const query = {
      restaurantId: restaurant.id,
      status: { $ne: 'cancelled' }
    };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const bookings = await Booking.find(query)
      .sort({ date: 1, time: 1 });
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel booking
router.post('/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get customer bookings by email
router.get('/customer/:email', async (req, res) => {
  try {
    const bookings = await Booking.find({
      customerEmail: req.params.email,
      date: { $gte: new Date() }
    }).sort({ date: 1, time: 1 });

    // Get restaurant details for each booking
    const bookingsWithRestaurant = await Promise.all(
      bookings.map(async (booking) => {
        const restaurant = await Restaurant.findOne({ id: booking.restaurantId });
        return {
          ...booking.toObject(),
          restaurant: restaurant ? {
            name: restaurant.name,
            address: restaurant.contact.address,
            phone: restaurant.contact.phone,
            email: restaurant.contact.email
          } : null
        };
      })
    );

    res.json(bookingsWithRestaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

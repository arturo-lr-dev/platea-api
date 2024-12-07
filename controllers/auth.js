const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, restaurant: restaurantData } = req.body;

  // Check if user with this email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorResponse('Email already registered', 400));
  }

  // Validate required restaurant data
  if (!restaurantData || !restaurantData.name || !restaurantData.id) {
    return next(new ErrorResponse('Please provide restaurant name and id', 400));
  }

  // Check if restaurant ID is already taken
  const existingRestaurant = await Restaurant.findOne({ id: restaurantData.id });
  if (existingRestaurant) {
    return next(new ErrorResponse('Restaurant ID already exists', 400));
  }

  // Create default booking configuration
  const defaultBookingConfig = {
    regularSchedule: {
      monday: [{ hour: "13:00", capacity: 50 }, { hour: "14:00", capacity: 50 }, { hour: "20:00", capacity: 50 }, { hour: "21:00", capacity: 50 }],
      tuesday: [{ hour: "13:00", capacity: 50 }, { hour: "14:00", capacity: 50 }, { hour: "20:00", capacity: 50 }, { hour: "21:00", capacity: 50 }],
      wednesday: [{ hour: "13:00", capacity: 50 }, { hour: "14:00", capacity: 50 }, { hour: "20:00", capacity: 50 }, { hour: "21:00", capacity: 50 }],
      thursday: [{ hour: "13:00", capacity: 50 }, { hour: "14:00", capacity: 50 }, { hour: "20:00", capacity: 50 }, { hour: "21:00", capacity: 50 }],
      friday: [{ hour: "13:00", capacity: 50 }, { hour: "14:00", capacity: 50 }, { hour: "20:00", capacity: 50 }, { hour: "21:00", capacity: 50 }],
      saturday: [{ hour: "13:00", capacity: 50 }, { hour: "14:00", capacity: 50 }, { hour: "20:00", capacity: 50 }, { hour: "21:00", capacity: 50 }],
      sunday: [{ hour: "13:00", capacity: 50 }, { hour: "14:00", capacity: 50 }, { hour: "20:00", capacity: 50 }, { hour: "21:00", capacity: 50 }]
    },
    tables: [
      { number: 1, capacity: 4, isActive: true },
      { number: 2, capacity: 4, isActive: true },
      { number: 3, capacity: 4, isActive: true },
      { number: 4, capacity: 4, isActive: true },
      { number: 5, capacity: 6, isActive: true },
      { number: 6, capacity: 6, isActive: true }
    ],
    maxBookingCapacity: restaurantData.maxBookingCapacity || 50,
    maxGuestsPerBooking: restaurantData.maxGuestsPerBooking || 10,
    minGuestsPerBooking: 1,
    defaultBookingDuration: 120,
    advanceBookingDays: 30,
    specialDates: [],
    closedDays: []
  };

  // Create restaurant with required fields and defaults
  const restaurant = await Restaurant.create({
    id: restaurantData.id,
    name: restaurantData.name,
    description: restaurantData.description || `Welcome to ${restaurantData.name}`,
    contact: {
      email: email,
      phone: restaurantData.phone || '',
      address: restaurantData.address || '',
      coordinates: {
        lat: restaurantData.lat || 0,
        lng: restaurantData.lng || 0
      }
    },
    menu: {
      featured: [],
      fullMenu: {
        starters: [],
        mainCourses: [],
        desserts: []
      },
      wine: []
    },
    bookingConfig: defaultBookingConfig,
    ...restaurantData
  });

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    restaurant: restaurant._id
  });

  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate('restaurant');
  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Log user out / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  // Secure cookies in production
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token
    });
};

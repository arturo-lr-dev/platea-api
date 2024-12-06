const mongoose = require('mongoose');

// Esquemas para la parte de presentación del restaurante
const logoSchema = new mongoose.Schema({
  type: String,
  content: String,
  imageUrl: String
});

const uiSchema = new mongoose.Schema({
  heroButtonText: String,
  heroBackgroundImage: String
});

const chefSchema = new mongoose.Schema({
  name: String,
  bio: String,
  image: String
});

const teamMemberSchema = new mongoose.Schema({
  name: String,
  position: String,
  description: String,
  image: String
});

const historySchema = new mongoose.Schema({
  content: String,
  chef: chefSchema,
  team: [teamMemberSchema]
});

const dishSchema = new mongoose.Schema({
  id: String,
  name: String,
  description: String,
  price: Number,
  image: String,
  ingredients: [String],
  seasonal: Boolean
});

const wineSchema = new mongoose.Schema({
  id: String,
  name: String,
  description: String,
  price: Number,
  year: Number
});

const menuSchema = new mongoose.Schema({
  featured: [dishSchema],
  fullMenu: {
    starters: [dishSchema],
    mainCourses: [dishSchema],
    desserts: [dishSchema]
  },
  wine: [wineSchema]
});

const contactSchema = new mongoose.Schema({
  phone: String,
  email: String,
  address: String,
  coordinates: {
    lat: Number,
    lng: Number
  }
});

const giftCardsSchema = new mongoose.Schema({
  prefix: String,
  validityDays: Number
});

// Esquemas para el sistema de reservas
const timeSlotSchema = new mongoose.Schema({
  hour: { type: String, required: true }, // Format: "HH:mm"
  capacity: { type: Number, required: true }
});

const specialDateSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  timeSlots: [timeSlotSchema],
  isHoliday: { type: Boolean, default: false },
  note: String
});

const tableSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  capacity: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
});

// Esquema principal del restaurante
const restaurantSchema = new mongoose.Schema({
  // Información de presentación
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  logo: logoSchema,
  slogan: String,
  description: String,
  ui: uiSchema,
  history: historySchema,
  menu: menuSchema,
  contact: contactSchema,
  giftCards: giftCardsSchema,

  // Configuración del sistema de reservas
  bookingConfig: {
    regularSchedule: {
      monday: [timeSlotSchema],
      tuesday: [timeSlotSchema],
      wednesday: [timeSlotSchema],
      thursday: [timeSlotSchema],
      friday: [timeSlotSchema],
      saturday: [timeSlotSchema],
      sunday: [timeSlotSchema]
    },
    specialDates: [specialDateSchema],
    tables: [tableSchema],
    defaultBookingDuration: { type: Number, default: 120 }, // en minutos
    maxBookingCapacity: { type: Number, required: true },
    minGuestsPerBooking: { type: Number, default: 1 },
    maxGuestsPerBooking: { type: Number, required: true },
    advanceBookingDays: { type: Number, default: 30 },
    closedDays: [String],
    specialNotes: String
  },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

restaurantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Restaurant', restaurantSchema);

const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  seats: { type: Number, required: true },
  vehicle: { type: String, required: true },
  fare: { type: Number, required: true },
  startLocation: { type: String, required: true },
  destinationLocation: { type: String, required: true },
  waypoints: {
    type: { type: String, default: 'LineString', required: true }, // Using LineString for routes
    coordinates: { type: [[Number]], required: true }, // Array of arrays of coordinates [ [lng, lat], ... ]
  },
});

driverSchema.index({ waypoints: '2dsphere' });

module.exports = mongoose.model('Driver', driverSchema);

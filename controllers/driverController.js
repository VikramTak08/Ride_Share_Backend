const Driver = require('../models/driverModel');

// Save driver data in database
const saveDriver = async (req, res) => {
  try {
    const newDriver = new Driver(req.body);
    const savedDriver = await newDriver.save();
    res.json({ message: 'Driver saved successfully!', driver: savedDriver });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Match drivers based on pickup and destination coordinates
const matchDrivers = async (req, res) => {
  const { pickupCoords, destinationCoords } = req.body;
  try {
    // Step 1: Find drivers near the pickup location
    const driversNearPickup = await Driver.find({
      waypoints: {
        $near: {
          $geometry: {
            type: 'LineString',
            coordinates: pickupCoords,
          },
          $maxDistance: 2000,  // 2 km radius
        },
      },
    });

    // Step 2: Filter drivers based on destination
    const matchedDrivers = driversNearPickup.filter((driver) => {
      const destinationMatch = driver.waypoints.coordinates.some((coord) => {
        const [lat, lng] = coord;
        const distance = calculateDistance(lat, lng, destinationCoords[0], destinationCoords[1]);
        return distance <= 2000;
      });
      return destinationMatch;
    });

    // Further filter drivers to prioritize those with a closer pickup
    const availableDrivers = matchedDrivers.filter((driver) => {
      const firstWaypoint = driver.waypoints.coordinates[0]; 
      const [firstLat, firstLng] = firstWaypoint;
      const distance1 = calculateDistance(firstLat, firstLng, destinationCoords[0], destinationCoords[1]);
      const distance2 = calculateDistance(firstLat, firstLng, pickupCoords[0], pickupCoords[1]);

      return distance1 > distance2;  // Prioritize drivers closer to pickup
    });

    res.json({ drivers: availableDrivers });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Utility function to calculate distance between two coordinates (in meters)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;  // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;  // Returns distance in meters
}

module.exports = { saveDriver, matchDrivers };

// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const driverRoutes = require('./routes/driverRoutes');

// dotenv.config();  // Loads environment variables from .env

// const app = express();
// const port = process.env.PORT || 5000;

// // Middleware
// app.use(cors());
// app.use(express.json({ limit: '100mb' }));
// app.use(express.urlencoded({ limit: '100mb', extended: true }));

// // Database connection
// mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('Connected to MongoDB'))
//   .catch(err => console.log(err));

// // Routes
// app.use('/api/drivers', driverRoutes);

// // Start the server
// app.listen(port, () => {
//   console.log(`Server is running on port: ${port}`);
// });

const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
// const socketIo = require('socket.io');
// const server = http.createServer(app);
const cors = require("cors");
const app = express();
const dotenv = require('dotenv');

dotenv.config();
const port = process.env.PORT || 5000;


//app.use(cors());
//"http://localhost:5173"
const corsOption = {
  origin: process.env.FRONT_URL,
  methods:["GET","POST"],
  credentials: true,
};
app.use(cors(corsOption));

// app.use(express.json());
app.use(express.json({ limit: "100mb" })); // or higher if needed
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

//mongoose.connect('mongodb://localhost:27017/driverDB', { useNewUrlParser: true, useUnifiedTopology: true });
// const io = socketIo(server, {
//   cors: {
//     origin: "http://localhost:5173",  // Frontend origin
//     methods: ["GET", "POST"],
//   },
// });

// const drivers = {}; // Store driver's locations
// io.on('connection', (socket) => {
//   console.log('Driver connected');

//   // Listen for driver's location (lat, lng)
//   socket.on('driverLocation', ({ phoneNumber, location }) => {
//     const { lat, lng } = location;
//     console.log(`Driver ${phoneNumber}: Latitude ${lat}, Longitude ${lng}`);

//     // Store the driver's location
//     drivers[phoneNumber] = location;

//     // Emit the location update to all clients tracking this driver
//     io.emit(`trackDriver_${phoneNumber}`, location);
//   });

//   // When a driver disconnects
//   socket.on('disconnect', () => {
//     console.log('Driver disconnected');
//   });
// });

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  seats: { type: Number, required: true },
  vehicle: { type: String, required: true },
  fare: { type: Number, required: true },
  startLocation: { type: String, required: true },
  destinationLocation: { type: String, required: true },
   waypoints: {
    type: {
      type: String,
      enum: ['LineString'], // restrict to LineString
      required: true,
    },
    coordinates: {
      type: [[Number]],
      required: true,
    },
  }
  // waypoints: {
  //   type: { type: String, default: "LineString", required: true }, // Using LineString for routes
  //   coordinates: { type: [[Number]], required: true }, // Array of arrays of coordinates [ [lng, lat], ... ]
  // },
});

// Create a 2dsphere index for the 'waypoints' field
driverSchema.index({ waypoints: "2dsphere" });

const Driver = mongoose.model("Driver", driverSchema);

//Save driver data in data in database
app.post("/api/drivers/save-driver", async (req, res) => {
  try {
    
    console.log("Received driver data:", req.body); // Log incoming data
    const newDriver = new Driver(req.body);
    const savedDriver = await newDriver.save();
    console.log("Saved Driver:", savedDriver); // Log saved driver
    res.json("Driver saved successfully!");
  } catch (err) {
    console.error("Error saving driver:", err.message); // Log error message
    res.status(400).json("Error: " + err.message);
  }
});

app.get("/test-db", async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.send("✅ MongoDB connected!");
  } catch (err) {
    res.status(500).send("❌ MongoDB NOT connected: " + err.message);
  }
});


app.post("/match-drivers", async (req, res) => {
  const { pickupCoords, destinationCoords } = req.body;
  console.log("Received rider data:", req.body);
  try {
    // Step 1: Find drivers whose routes are near the rider's pickup location

    const radiusInMeters = 2000;
const earthRadiusInMeters = 6378137;
    const driversNearPickup = await Driver.find({


      waypoints: {
    $geoWithin: {
      $centerSphere: [
        pickupCoords, // [lng, lat]
        radiusInMeters / earthRadiusInMeters
      ]
    }
  }
      // waypoints: {
      //   $near: {
      //     $geometry: {
      //       type: "Point",
      //       coordinates: pickupCoords,
      //     },
      //     $maxDistance: 2000,
      //   },
      // },
    });

    // Step 2: Filter drivers further by checking if their routes are also near the destination location
    const matchedDrivers = driversNearPickup.filter((driver) => {
      const destinationMatch = driver.waypoints.coordinates.some((coord) => {
        const [lat, lng] = coord;
        const distance = calculateDistance(
          lat,
          lng,
          destinationCoords[0],
          destinationCoords[1]
        );
        return distance <= 2000; // Check if any part of the route is within 2000 meters of the destination
      });

      return destinationMatch;
    });

    const availableDrivers = matchedDrivers.filter((driver) => {
      const firstWaypoint = driver.waypoints.coordinates[0];
      const [firstLat, firstLng] = firstWaypoint;
      const distance1 = calculateDistance(
        firstLat,
        firstLng,
        destinationCoords[0],
        destinationCoords[1]
      );
      const distance2 = calculateDistance(
        firstLat,
        firstLng,
        pickupCoords[0],
        pickupCoords[1]
      );
      console.log("driver name :", driver.name);
      console.log("d1 :", distance1);
      console.log("d2 :", distance2);

      return distance1 > distance2;
    });

    res.json({ drivers: availableDrivers });
    console.log("driver list :", availableDrivers);
  } catch (error) {
    console.error("Error matching drivers:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Utility function to calculate distance between two coordinates (in meters)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// Get all drivers
app.get("/drivers", async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.status(200).json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

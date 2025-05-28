const express = require('express');
const { saveDriver, matchDrivers } = require('../controllers/driverController');

const router = express.Router();

router.post('/save-driver', saveDriver);
router.post('/match-drivers', matchDrivers);

module.exports = router;

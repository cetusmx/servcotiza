const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Métrica de asertividad cíclica
router.get('/asertividad', dashboardController.getAsertividad);

module.exports = router;

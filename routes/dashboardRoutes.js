const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Métrica de asertividad cíclica
router.get('/asertividad', dashboardController.getAsertividad);

// Métrica SKU/hr (productos contados por hora laboral)
router.get('/sku-hr', dashboardController.getSkuPorHora);

module.exports = router;

const express = require('express');
const router = express.Router();
const recepcionController = require('../controllers/recepcionController');

// Ruta principal para consultar las claves de productos en recepción
// Al estar montado en '/recepcion' dentro de index.js, 
// el endpoint completo será: POST /recepcion/productos
router.post('/productos', recepcionController.getProductosRecepcion);

module.exports = router;

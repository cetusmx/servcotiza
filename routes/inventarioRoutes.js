const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');

// Consulta masiva de productos para impresión de etiquetas de caja (Puente a Firebird)
// Endpoint completo: POST /inventario/productos-etiquetas-caja
router.post('/productos-etiquetas-caja', inventarioController.getProductosEtiquetasCaja);

module.exports = router;

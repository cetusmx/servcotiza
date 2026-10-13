const express = require('express');
const router = express.Router();
const recepcionController = require('../controllers/recepcionController');

// 1. Proxy hacia Firebird para equivalencias de claves
router.post('/productos', recepcionController.getProductosRecepcion);

// 2. Comprador: Sube XML, crea cabecera y desglosa partidas
router.post('/crear', recepcionController.crearRecepcion);

// 3. Operador: Lista facturas pendientes por recibir en sucursal
router.get('/pendientes', recepcionController.getPendientes);

// 4. Comprador: Monitoreo global de facturas y estatus
router.get('/monitoreo-compras', recepcionController.getMonitoreoCompras);

// 4.1 Comprador: Valida si una factura ya fue registrada (evitar duplicados)
router.get('/validar-existente', recepcionController.validarExistente);

// 5. Ambos: Detalle completo de la factura y partidas
router.get('/:id/detalle', recepcionController.getDetalle);

// 6. Operador: Guarda progreso parcial del conteo
router.put('/:id/progreso', recepcionController.guardarProgreso);

// 7. Operador: Envía conteo real y observaciones de sucursal
router.post('/:id/finalizar', recepcionController.finalizarRecepcion);

// 8. Comprador: Cierra la factura tras descargar el archivo .MOD
router.put('/:id/cerrar-oc', recepcionController.cerrarOC);

// 9. Comprador: Elimina factura y partidas asociadas (por error de asignación o subida)
router.delete('/:id', recepcionController.eliminarRecepcion);

module.exports = router;

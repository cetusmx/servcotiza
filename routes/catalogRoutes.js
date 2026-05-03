const express = require('express');
const router = express.Router();
const { getClavesProveedor, getClaveUnitaria, getAlmacenes } = require('../services/firebirdService');

// 1. Consulta Masiva (POST)
router.post('/getclavesproveedor', async (req, res) => {
    try {
        const { rfc, claves } = req.body;
        if (!rfc || !claves) {
            return res.status(400).json({ error: "RFC y arreglo de claves son requeridos" });
        }
        
        const data = await getClavesProveedor({ rfc, claves });
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Error al conectar con el catálogo externo" });
    }
});

// 2. Consulta Unitaria (GET)
router.get('/getclavesproveedor', async (req, res) => {
    try {
        const { rfc, clave } = req.query;
        if (!rfc || !clave) {
            return res.status(400).json({ error: "Parámetros rfc y clave son obligatorios" });
        }

        const data = await getClaveUnitaria(rfc, clave);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Error al consultar clave individual" });
    }
});

router.get('/getalmacenes', async (req, res) => {
    try {
        const data = await getAlmacenes();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ 
            error: "Error al obtener el catálogo de almacenes",
            details: error.message 
        });
    }
});

module.exports = router;
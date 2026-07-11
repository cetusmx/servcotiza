const dashboardService = require('../services/dashboardService');

const MAPEO_INVENTARIOS = {
    INVMAY: '052026-1'
};

const resolveInventarioId = (inventarioId) => MAPEO_INVENTARIOS[inventarioId] || inventarioId;

const getAsertividad = async (req, res) => {
    try {
        const { inventarioId } = req.query;

        if (!inventarioId) {
            return res.status(400).json({ error: "El parámetro inventarioId es requerido" });
        }

        const localInventarioId = resolveInventarioId(inventarioId);
        const data = await dashboardService.getAsertividadCiclica(inventarioId, localInventarioId);
        res.status(200).json(data);
    } catch (error) {
        console.error("Error en dashboardController.getAsertividad:", error);
        res.status(500).json({ 
            error: "Error al procesar la métrica de asertividad",
            details: error.message 
        });
    }
};

const getSkuPorHora = async (req, res) => {
    try {
        const { inventarioId } = req.query;

        if (!inventarioId) {
            return res.status(400).json({ error: "El parámetro inventarioId es requerido" });
        }

        const data = await dashboardService.getSkuPorHora(resolveInventarioId(inventarioId));
        res.status(200).json(data);
    } catch (error) {
        console.error("Error en dashboardController.getSkuPorHora:", error);
        res.status(500).json({ 
            error: "Error al procesar la métrica SKU/hr",
            details: error.message 
        });
    }
};

module.exports = {
    getAsertividad,
    getSkuPorHora
};

const dashboardService = require('../services/dashboardService');

const getAsertividad = async (req, res) => {
    try {
        const { inventarioId } = req.query;

        if (!inventarioId) {
            return res.status(400).json({ error: "El parámetro inventarioId es requerido" });
        }

        const data = await dashboardService.getAsertividadCiclica(inventarioId);
        res.status(200).json(data);
    } catch (error) {
        console.error("Error en dashboardController.getAsertividad:", error);
        res.status(500).json({ 
            error: "Error al procesar la métrica de asertividad",
            details: error.message 
        });
    }
};

module.exports = {
    getAsertividad
};

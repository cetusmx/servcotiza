const { getProductosEtiquetasCaja: fetchProductosEtiquetasCaja } = require('../services/firebirdService');

/**
 * POST /inventario/productos-etiquetas-caja
 * Puente hacia Firebird (/api/productos/productos-etiquetas-caja).
 * Acepta tanto { "productos": [...] } como { "claves": [...] }.
 */
const getProductosEtiquetasCaja = async (req, res) => {
    try {
        const { productos, claves } = req.body || {};
        const lista = Array.isArray(productos) ? productos : Array.isArray(claves) ? claves : null;

        if (!lista) {
            return res.status(400).json({
                error: "Parámetros inválidos. Se requiere un arreglo en 'productos' o 'claves'."
            });
        }

        const data = await fetchProductosEtiquetasCaja(req.body);
        res.status(200).json(data);
    } catch (error) {
        console.error("Error en inventarioController.getProductosEtiquetasCaja:", error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({
            error: "Error interno al consultar información de productos para etiquetas de caja",
            details: error.message
        });
    }
};

module.exports = {
    getProductosEtiquetasCaja
};

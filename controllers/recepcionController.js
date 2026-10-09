const { getProductosRecepcion: fetchProductosRecepcion } = require('../services/firebirdService');

const getProductosRecepcion = async (req, res) => {
    try {
        const { rfc, claves_proveedor } = req.body;

        if (!rfc || !claves_proveedor || !Array.isArray(claves_proveedor)) {
            return res.status(400).json({ 
                error: "Parámetros inválidos. Se requiere 'rfc' (string) y 'claves_proveedor' (array)." 
            });
        }

        // Llamada al servicio que se conecta con la API externa de Firebird
        const data = await fetchProductosRecepcion(rfc, claves_proveedor);
        
        // Devolvemos la salida tal cual (como puente)
        res.status(200).json(data);
    } catch (error) {
        console.error("Error en getProductosRecepcion (Controller):", error);
        // Si el error viene de axios (de la API externa)
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ 
            error: "Error interno al procesar la solicitud de productos para recepción", 
            details: error.message 
        });
    }
};

module.exports = {
    getProductosRecepcion
};

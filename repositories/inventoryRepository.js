const pool = require('../db');

/**
 * Obtiene las claves de los productos que ya han sido contabilizados para un inventario específico.
 * @param {string} inventarioId - ID del inventario (refer)
 */
const getContadosByInventario = async (inventarioId) => {
    try {
        const [rows] = await pool.query(
            'SELECT Clave, Existencia, Descripcion, Unidad, Auditor, Linea FROM ProductoContados WHERE InventarioID = ?',
            [inventarioId]
        );
        return rows;
    } catch (error) {
        console.error("Error en inventoryRepository.getContadosByInventario:", error);
        throw error;
    }
};

module.exports = {
    getContadosByInventario
};

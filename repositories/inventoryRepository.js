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

const getAlmacenByInventario = async (inventarioId) => {
    try {
        const [rows] = await pool.query(
            'SELECT Almacen FROM Inventarios WHERE InventarioID = ? LIMIT 1',
            [inventarioId]
        );
        return rows.length > 0 ? rows[0].Almacen : null;
    } catch (error) {
        console.error("Error en inventoryRepository.getAlmacenByInventario:", error);
        throw error;
    }
};

const getRotacionesByClaveAlmacen = async (claves, almacenes) => {
    try {
        const [rows] = await pool.query(
            'SELECT clave, almacen, rotacion FROM stocks_almacenes WHERE clave IN (?) AND almacen IN (?)',
            [claves, almacenes]
        );
        const map = {};
        for (const r of rows) {
            map[`${r.clave}|${r.almacen}`] = r.rotacion;
        }
        return map;
    } catch (error) {
        console.error("Error en inventoryRepository.getRotacionesByClaveAlmacen:", error);
        throw error;
    }
};

const getLineasConTimestamp = async (inventarioId) => {
    try {
        const [rows] = await pool.query(
            `SELECT Linea, createdAt, COUNT(*) AS productos
             FROM ProductoContados
             WHERE InventarioID = ?
             GROUP BY Linea, createdAt
             ORDER BY createdAt`,
            [inventarioId]
        );
        return rows;
    } catch (error) {
        console.error("Error en inventoryRepository.getLineasConTimestamp:", error);
        throw error;
    }
};

module.exports = {
    getContadosByInventario,
    getAlmacenByInventario,
    getRotacionesByClaveAlmacen,
    getLineasConTimestamp
};

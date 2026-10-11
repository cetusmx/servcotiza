const pool = require('../db');

/**
 * Crea la cabecera y el detalle de una nueva recepción en una sola transacción.
 */
const createRecepcion = async (cabecera, partidas) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const insertCabeceraSql = `
            INSERT INTO recepciones_facturas (
                folio_factura, uuid_sat, rfc_proveedor, nombre_proveedor,
                nombre_receptor, rfc_receptor,
                sucursal_destino, almacen_sae, fecha_factura, subido_por,
                total_partidas, total_piezas_facturadas, total_piezas_recibidas,
                tiene_incidencias, observaciones_generales, xml_original, estatus
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const cabeceraValues = [
            cabecera.folio_factura,
            cabecera.uuid_sat || null,
            cabecera.rfc_proveedor,
            cabecera.nombre_proveedor,
            cabecera.nombre_receptor || null,
            cabecera.rfc_receptor || null,
            cabecera.sucursal_destino,
            cabecera.almacen_sae || null,
            cabecera.fecha_factura || null,
            cabecera.subido_por || null,
            cabecera.total_partidas,
            cabecera.total_piezas_facturadas,
            cabecera.total_piezas_recibidas || 0.00,
            cabecera.tiene_incidencias || 0,
            cabecera.observaciones_generales || null,
            cabecera.xml_original || null,
            cabecera.estatus || 'PENDIENTE'
        ];

        const [cabeceraResult] = await connection.query(insertCabeceraSql, cabeceraValues);
        const recepcionId = cabeceraResult.insertId;

        if (partidas && partidas.length > 0) {
            const partidasSql = `
                INSERT INTO recepciones_facturas_partidas (
                    recepcion_id, numero_partida, clave_proveedor, clave_interna,
                    descripcion, cantidad_facturada, cantidad_recibida, precio_unitario,
                    importe, descuento_porcentaje, estatus_partida, observacion
                ) VALUES ?
            `;

            const partidasValues = partidas.map((p, index) => [
                recepcionId,
                p.numero_partida || (index + 1),
                p.clave_proveedor,
                p.clave_interna || null,
                p.descripcion || null,
                p.cantidad_facturada,
                p.cantidad_recibida || 0.00,
                p.precio_unitario || 0.0000,
                p.importe || (Number(p.cantidad_facturada || 0) * Number(p.precio_unitario || 0)),
                p.descuento_porcentaje || 0.00,
                p.estatus_partida || 'PENDIENTE',
                p.observacion || null
            ]);

            await connection.query(partidasSql, [partidasValues]);
        }

        await connection.commit();
        return recepcionId;
    } catch (error) {
        await connection.rollback();
        console.error("Error en recepcionRepository.createRecepcion:", error);
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Obtiene las recepciones pendientes para una sucursal (o todas si no se especifica).
 */
const getPendientesBySucursal = async (sucursal) => {
    try {
        let sql = `
            SELECT id, folio_factura, uuid_sat, rfc_proveedor, nombre_proveedor,
                   nombre_receptor, rfc_receptor,
                   sucursal_destino, almacen_sae, fecha_factura, fecha_subida,
                   fecha_recepcion, subido_por, recibido_por, estatus,
                   total_partidas, total_piezas_facturadas, total_piezas_recibidas,
                   tiene_incidencias, observaciones_generales
            FROM recepciones_facturas
            WHERE (
                estatus IN ('PENDIENTE', 'EN_RECEPCION')
                OR (
                    estatus IN ('RECIBIDO_COMPLETO', 'RECIBIDO_CON_INCIDENCIA', 'OC_GENERADA')
                    AND COALESCE(fecha_recepcion, fecha_subida) >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
                )
            )
        `;
        const params = [];

        if (sucursal && sucursal !== 'TODAS' && sucursal !== 'todas' && sucursal !== 'admin') {
            sql += ` AND (sucursal_destino = ? OR sucursal_destino LIKE ?)`;
            params.push(sucursal, `%${sucursal}%`);
        }

        sql += ` ORDER BY CASE WHEN estatus IN ('PENDIENTE', 'EN_RECEPCION') THEN 0 ELSE 1 END ASC, COALESCE(fecha_recepcion, fecha_subida) DESC`;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        console.error("Error en recepcionRepository.getPendientesBySucursal:", error);
        throw error;
    }
};

/**
 * Obtiene la cabecera y todas las partidas de una recepción por ID.
 */
const getRecepcionDetalleById = async (id) => {
    try {
        const [cabeceraRows] = await pool.query(
            `SELECT * FROM recepciones_facturas WHERE id = ?`,
            [id]
        );

        if (cabeceraRows.length === 0) {
            return null;
        }

        const [partidasRows] = await pool.query(
            `SELECT * FROM recepciones_facturas_partidas WHERE recepcion_id = ? ORDER BY numero_partida ASC`,
            [id]
        );

        return {
            ...cabeceraRows[0],
            partidas: partidasRows
        };
    } catch (error) {
        console.error("Error en recepcionRepository.getRecepcionDetalleById:", error);
        throw error;
    }
};

/**
 * Cambia el estado a EN_RECEPCION si está en PENDIENTE.
 */
const marcarEnRecepcion = async (id) => {
    try {
        const [result] = await pool.query(
            `UPDATE recepciones_facturas SET estatus = 'EN_RECEPCION' WHERE id = ? AND estatus = 'PENDIENTE'`,
            [id]
        );
        return result.affectedRows > 0;
    } catch (error) {
        console.error("Error en recepcionRepository.marcarEnRecepcion:", error);
        throw error;
    }
};

/**
 * Finaliza el conteo físico de la recepción y actualiza partidas y totales.
 */
const finalizarRecepcion = async (id, { recibido_por, observaciones_generales, partidas }) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Validar existencia
        const [cabecera] = await connection.query(
            `SELECT id, total_piezas_facturadas, estatus FROM recepciones_facturas WHERE id = ? FOR UPDATE`,
            [id]
        );

        if (cabecera.length === 0) {
            throw new Error(`La recepción con ID ${id} no existe.`);
        }

        if (['OC_GENERADA', 'CANCELADO'].includes(cabecera[0].estatus)) {
            throw new Error(`No se puede finalizar una recepción con estatus ${cabecera[0].estatus}.`);
        }

        // 2. Actualizar cada partida recibida
        if (partidas && partidas.length > 0) {
            for (const p of partidas) {
                await connection.query(
                    `UPDATE recepciones_facturas_partidas
                     SET cantidad_recibida = ?,
                         estatus_partida = ?,
                         observacion = COALESCE(?, observacion)
                     WHERE id = ? AND recepcion_id = ?`,
                    [
                        Number(p.cantidad_recibida || 0),
                        p.estatus_partida,
                        p.observacion || null,
                        p.id,
                        id
                    ]
                );
            }
        }

        // 3. Consultar todas las partidas de la recepción para calcular totales precisos
        const [todasPartidas] = await connection.query(
            `SELECT cantidad_facturada, cantidad_recibida, estatus_partida FROM recepciones_facturas_partidas WHERE recepcion_id = ?`,
            [id]
        );

        let totalRecibidas = 0;
        let tieneIncidencias = 0;

        if (observaciones_generales && observaciones_generales.trim() !== '') {
            tieneIncidencias = 1;
        }

        for (const item of todasPartidas) {
            const facturada = Number(item.cantidad_facturada || 0);
            const recibida = Number(item.cantidad_recibida || 0);
            totalRecibidas += recibida;

            if (
                facturada !== recibida ||
                item.estatus_partida === 'INCOMPLETA' ||
                item.estatus_partida === 'DANADA' ||
                item.estatus_partida === 'NO_RECIBIDA' ||
                (item.observacion && item.observacion.trim() !== '')
            ) {
                tieneIncidencias = 1;
            }
        }

        const nuevoEstatus = tieneIncidencias === 1 ? 'RECIBIDO_CON_INCIDENCIA' : 'RECIBIDO_COMPLETO';

        // 4. Actualizar la cabecera
        await connection.query(
            `UPDATE recepciones_facturas
             SET fecha_recepcion = NOW(),
                 recibido_por = ?,
                 estatus = ?,
                 total_piezas_recibidas = ?,
                 tiene_incidencias = ?,
                 observaciones_generales = COALESCE(?, observaciones_generales)
             WHERE id = ?`,
            [
                recibido_por || null,
                nuevoEstatus,
                totalRecibidas,
                tieneIncidencias,
                observaciones_generales || null,
                id
            ]
        );

        await connection.commit();

        return {
            id,
            estatus: nuevoEstatus,
            total_piezas_recibidas: totalRecibidas,
            tiene_incidencias: tieneIncidencias
        };
    } catch (error) {
        await connection.rollback();
        console.error("Error en recepcionRepository.finalizarRecepcion:", error);
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Consulta todas las recepciones para monitoreo por parte del Comprador.
 */
const getMonitoreoCompras = async (filtros = {}) => {
    try {
        let sql = `
            SELECT id, folio_factura, uuid_sat, rfc_proveedor, nombre_proveedor,
                   nombre_receptor, rfc_receptor,
                   sucursal_destino, almacen_sae, fecha_factura, fecha_subida,
                   subido_por, fecha_recepcion, recibido_por, estatus,
                   total_partidas, total_piezas_facturadas, total_piezas_recibidas,
                   tiene_incidencias, observaciones_generales
            FROM recepciones_facturas
            WHERE 1=1
        `;
        const params = [];

        if (filtros.sucursal) {
            sql += ` AND sucursal_destino = ?`;
            params.push(filtros.sucursal);
        }

        if (filtros.estatus) {
            sql += ` AND estatus = ?`;
            params.push(filtros.estatus);
        }

        if (filtros.rfc) {
            sql += ` AND rfc_proveedor = ?`;
            params.push(filtros.rfc);
        }

        sql += ` ORDER BY fecha_subida DESC`;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        console.error("Error en recepcionRepository.getMonitoreoCompras:", error);
        throw error;
    }
};

/**
 * Marca la factura como OC_GENERADA.
 */
const marcarOCGenerada = async (id) => {
    try {
        const [result] = await pool.query(
            `UPDATE recepciones_facturas
             SET estatus = 'OC_GENERADA'
             WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    } catch (error) {
        console.error("Error en recepcionRepository.marcarOCGenerada:", error);
        throw error;
    }
};

/**
 * Guarda el progreso parcial de recepción de una factura sin finalizarla.
 */
const guardarProgresoRecepcion = async (id, { partidas }) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        if (partidas && partidas.length > 0) {
            for (const p of partidas) {
                await connection.query(
                    `UPDATE recepciones_facturas_partidas
                     SET cantidad_recibida = ?,
                         estatus_partida = ?,
                         observacion = ?
                     WHERE id = ? AND recepcion_id = ?`,
                    [
                        Number(p.cantidad_recibida || 0),
                        p.estatus_partida || (Number(p.cantidad_recibida || 0) > 0 ? 'COMPLETA' : 'PENDIENTE'),
                        p.observacion || null,
                        p.id,
                        id
                    ]
                );
            }
        }

        const [sumRows] = await connection.query(
            `SELECT COALESCE(SUM(cantidad_recibida), 0) as totalRecibidas
             FROM recepciones_facturas_partidas WHERE recepcion_id = ?`,
            [id]
        );
        const totalRecibidas = sumRows[0]?.totalRecibidas || 0;

        await connection.query(
            `UPDATE recepciones_facturas
             SET total_piezas_recibidas = ?,
                 estatus = 'EN_RECEPCION'
             WHERE id = ? AND estatus IN ('PENDIENTE', 'EN_RECEPCION')`,
            [totalRecibidas, id]
        );

        await connection.commit();
        return { success: true, totalRecibidas };
    } catch (error) {
        await connection.rollback();
        console.error("Error en recepcionRepository.guardarProgresoRecepcion:", error);
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    createRecepcion,
    getPendientesBySucursal,
    getRecepcionDetalleById,
    marcarEnRecepcion,
    finalizarRecepcion,
    getMonitoreoCompras,
    marcarOCGenerada,
    guardarProgresoRecepcion
};

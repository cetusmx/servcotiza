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

        // Consultar evidencias fotográficas (sin el campo foto_blob para mantener la respuesta ligera)
        const [evidenciasRows] = await pool.query(
            `SELECT id, recepcion_id, partida_id, nombre_archivo, mime_type, tamano_bytes, subido_por, fecha_subida 
             FROM recepciones_evidencias_fotos 
             WHERE recepcion_id = ? 
             ORDER BY fecha_subida ASC`,
            [id]
        );

        // Consultar bitácora de seguimiento
        const [bitacoraRows] = await pool.query(
            `SELECT id, recepcion_id, usuario, comentario, fecha 
             FROM recepciones_bitacora_seguimiento 
             WHERE recepcion_id = ? 
             ORDER BY fecha DESC`,
            [id]
        );

        const partidasConFotos = partidasRows.map(p => ({
            ...p,
            fotos: evidenciasRows.filter(ev => ev.partida_id === p.id)
        }));

        return {
            ...cabeceraRows[0],
            partidas: partidasConFotos,
            evidencias: evidenciasRows,
            bitacora: bitacoraRows
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
const finalizarRecepcion = async (id, { recibido_por, observaciones_generales, partidas, fotos }) => {
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
            `SELECT cantidad_facturada, cantidad_recibida, estatus_partida, observacion FROM recepciones_facturas_partidas WHERE recepcion_id = ?`,
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

            const tieneObs = Boolean(item.observacion && item.observacion.trim() !== '');
            const esAnomalia = Boolean(item.estatus_partida && !['PENDIENTE', 'COMPLETA'].includes(item.estatus_partida));

            if (
                facturada !== recibida ||
                esAnomalia ||
                tieneObs
            ) {
                tieneIncidencias = 1;
            }
        }

        const nuevoEstatus = tieneIncidencias === 1 ? 'RECIBIDO_CON_INCIDENCIA' : 'RECIBIDO_COMPLETO';
        const nuevoEstatusIncidencia = tieneIncidencias === 1 ? 'PENDIENTE' : 'SIN_INCIDENCIA';

        // 4. Actualizar la cabecera
        await connection.query(
            `UPDATE recepciones_facturas
             SET fecha_recepcion = NOW(),
                 recibido_por = ?,
                 estatus = ?,
                 estatus_incidencia = ?,
                 total_piezas_recibidas = ?,
                 tiene_incidencias = ?,
                 observaciones_generales = COALESCE(?, observaciones_generales)
             WHERE id = ?`,
            [
                recibido_por || null,
                nuevoEstatus,
                nuevoEstatusIncidencia,
                totalRecibidas,
                tieneIncidencias,
                observaciones_generales || null,
                id
            ]
        );

        // 5. Guardar fotos de evidencia de partidas
        if (partidas && partidas.length > 0) {
            for (const p of partidas) {
                if (p.fotos && Array.isArray(p.fotos) && p.fotos.length > 0) {
                    for (const f of p.fotos) {
                        if (f.foto_base64) {
                            const buffer = Buffer.from(f.foto_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                            await connection.query(
                                `INSERT INTO recepciones_evidencias_fotos (
                                    recepcion_id, partida_id, nombre_archivo, mime_type, tamano_bytes, foto_blob, subido_por
                                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    id,
                                    p.id || null,
                                    f.nombre_archivo || 'evidencia.jpg',
                                    f.mime_type || 'image/jpeg',
                                    buffer.length,
                                    buffer,
                                    recibido_por || null
                                ]
                            );
                        }
                    }
                }
            }
        }

        // 6. Guardar fotos generales si existen
        if (fotos && Array.isArray(fotos) && fotos.length > 0) {
            for (const f of fotos) {
                if (f.foto_base64) {
                    const buffer = Buffer.from(f.foto_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                    await connection.query(
                        `INSERT INTO recepciones_evidencias_fotos (
                            recepcion_id, partida_id, nombre_archivo, mime_type, tamano_bytes, foto_blob, subido_por
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            f.partida_id || null,
                            f.nombre_archivo || 'evidencia.jpg',
                            f.mime_type || 'image/jpeg',
                            buffer.length,
                            buffer,
                            recibido_por || null
                        ]
                    );
                }
            }
        }

        // 7. Si hubo incidencias, registrar en la bitácora inicial
        if (tieneIncidencias === 1) {
            await connection.query(
                `INSERT INTO recepciones_bitacora_seguimiento (recepcion_id, usuario, comentario) VALUES (?, ?, ?)`,
                [id, recibido_por || 'Almacén', `Recepción física finalizada con incidencias reportadas por ${recibido_por || 'Operador de Almacén'}.`]
            );
        }

        await connection.commit();

        return {
            id,
            estatus: nuevoEstatus,
            estatus_incidencia: nuevoEstatusIncidencia,
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
                   tiene_incidencias, estatus_incidencia, tipo_resolucion, folio_nota_credito,
                   monto_nota_credito, comentarios_resolucion, fecha_resolucion, resuelto_por,
                   observaciones_generales
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

/**
 * Busca si ya existe una factura activa o registrada por UUID del SAT o combinación de Folio y RFC.
 */
const findFacturaExistente = async ({ uuid_sat, folio_factura, rfc_proveedor }) => {
    try {
        const conditions = [];
        const params = [];

        if (uuid_sat && uuid_sat.trim() !== '') {
            conditions.push(`LOWER(TRIM(uuid_sat)) = LOWER(TRIM(?))`);
            params.push(uuid_sat.trim());
        }

        if (folio_factura && folio_factura.trim() !== '' && rfc_proveedor && rfc_proveedor.trim() !== '') {
            conditions.push(`(LOWER(TRIM(folio_factura)) = LOWER(TRIM(?)) AND LOWER(TRIM(rfc_proveedor)) = LOWER(TRIM(?)))`);
            params.push(folio_factura.trim(), rfc_proveedor.trim());
        }

        if (conditions.length === 0) {
            return null;
        }

        const sql = `
            SELECT id, folio_factura, uuid_sat, rfc_proveedor, nombre_proveedor,
                   sucursal_destino, almacen_sae, estatus, fecha_subida, subido_por
            FROM recepciones_facturas
            WHERE estatus != 'CANCELADO'
              AND (${conditions.join(' OR ')})
            LIMIT 1
        `;

        const [rows] = await pool.query(sql, params);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error en recepcionRepository.findFacturaExistente:", error);
        throw error;
    }
};

/**
 * Elimina una recepción física y todas sus partidas asociadas.
 */
const deleteRecepcion = async (id) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(
            'SELECT id, folio_factura, uuid_sat, rfc_proveedor, nombre_proveedor, sucursal_destino, estatus FROM recepciones_facturas WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return null;
        }

        const factura = rows[0];

        if (String(factura.estatus || '').toUpperCase() !== 'PENDIENTE') {
            await connection.rollback();
            const err = new Error(`No es posible eliminar la factura ${factura.folio_factura} porque ya ha iniciado o completado su recepción en sucursal (estatus actual: ${factura.estatus}). Solo se permite eliminar en estatus PENDIENTE.`);
            err.statusCode = 400;
            throw err;
        }

        // Eliminar partidas asociadas
        await connection.query('DELETE FROM recepciones_facturas_partidas WHERE recepcion_id = ?', [id]);

        // Eliminar cabecera
        await connection.query('DELETE FROM recepciones_facturas WHERE id = ?', [id]);

        await connection.commit();
        return factura;
    } catch (error) {
        await connection.rollback();
        console.error("Error en recepcionRepository.deleteRecepcion:", error);
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Guarda una foto de evidencia en la base de datos (foto_blob).
 */
const guardarFotoEvidencia = async ({ recepcion_id, partida_id, nombre_archivo, mime_type, tamano_bytes, foto_buffer, subido_por }) => {
    try {
        const sql = `
            INSERT INTO recepciones_evidencias_fotos (
                recepcion_id, partida_id, nombre_archivo, mime_type, tamano_bytes, foto_blob, subido_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(sql, [
            recepcion_id,
            partida_id || null,
            nombre_archivo || 'evidencia.jpg',
            mime_type || 'image/jpeg',
            tamano_bytes || (foto_buffer ? foto_buffer.length : 0),
            foto_buffer,
            subido_por || null
        ]);
        return result.insertId;
    } catch (error) {
        console.error("Error en recepcionRepository.guardarFotoEvidencia:", error);
        throw error;
    }
};

/**
 * Obtiene el contenido binario (blob) y metadatos de una foto por su ID.
 */
const getFotoBlobById = async (id) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, recepcion_id, partida_id, nombre_archivo, mime_type, tamano_bytes, foto_blob 
             FROM recepciones_evidencias_fotos 
             WHERE id = ?`,
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error en recepcionRepository.getFotoBlobById:", error);
        throw error;
    }
};

/**
 * Elimina una foto de evidencia por su ID.
 */
const deleteFotoById = async (id) => {
    try {
        const [result] = await pool.query(
            `DELETE FROM recepciones_evidencias_fotos WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    } catch (error) {
        console.error("Error en recepcionRepository.deleteFotoById:", error);
        throw error;
    }
};

/**
 * Agrega una nota de seguimiento a la bitácora de la recepción.
 */
const agregarNotaBitacora = async (recepcion_id, { usuario, comentario }) => {
    try {
        const [facturaRows] = await pool.query(
            `SELECT folio_factura, estatus_incidencia FROM recepciones_facturas WHERE id = ?`,
            [recepcion_id]
        );

        if (facturaRows.length === 0) {
            const err = new Error(`La recepción con ID ${recepcion_id} no existe.`);
            err.statusCode = 404;
            throw err;
        }

        if (facturaRows[0].estatus_incidencia === 'INCIDENCIA_RESUELTA') {
            const err = new Error(`No es posible agregar notas a la bitácora porque la incidencia de la factura ${facturaRows[0].folio_factura} ya se encuentra RESUELTA.`);
            err.statusCode = 400;
            throw err;
        }

        const sql = `
            INSERT INTO recepciones_bitacora_seguimiento (recepcion_id, usuario, comentario)
            VALUES (?, ?, ?)
        `;
        const [result] = await pool.query(sql, [recepcion_id, usuario || 'Comprador', comentario]);
        return result.insertId;
    } catch (error) {
        console.error("Error en recepcionRepository.agregarNotaBitacora:", error);
        throw error;
    }
};

/**
 * Consulta la bitácora de seguimiento de una recepción.
 */
const getBitacoraByRecepcionId = async (recepcion_id) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, recepcion_id, usuario, comentario, fecha 
             FROM recepciones_bitacora_seguimiento 
             WHERE recepcion_id = ? 
             ORDER BY fecha DESC`,
            [recepcion_id]
        );
        return rows;
    } catch (error) {
        console.error("Error en recepcionRepository.getBitacoraByRecepcionId:", error);
        throw error;
    }
};

/**
 * Actualiza el estatus comercial de la incidencia, datos de resolución y registra los eventos en la bitácora.
 */
const actualizarSeguimientoIncidencia = async (id, data) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Consultar estado actual
        const [actualRows] = await connection.query(
            `SELECT id, folio_factura, estatus, estatus_incidencia FROM recepciones_facturas WHERE id = ? FOR UPDATE`,
            [id]
        );

        if (actualRows.length === 0) {
            const err = new Error(`La recepción con ID ${id} no existe.`);
            err.statusCode = 404;
            throw err;
        }

        const facturaActual = actualRows[0];

        // 2. Restricción estricta: si ya estaba resuelta, no permitir modificaciones
        if (facturaActual.estatus_incidencia === 'INCIDENCIA_RESUELTA') {
            await connection.rollback();
            const err = new Error(`La incidencia de la factura ${facturaActual.folio_factura} ya se encuentra RESUELTA. No está permitido modificar sus datos de seguimiento ni estatus.`);
            err.statusCode = 400;
            throw err;
        }

        const {
            estatus_incidencia,
            tipo_resolucion,
            folio_nota_credito,
            monto_nota_credito,
            comentarios_resolucion,
            resuelto_por,
            partidas,
            nota_bitacora
        } = data;

        const updateCabeceraSql = `
            UPDATE recepciones_facturas
            SET estatus_incidencia = COALESCE(?, estatus_incidencia),
                tipo_resolucion = ?,
                folio_nota_credito = ?,
                monto_nota_credito = ?,
                comentarios_resolucion = ?,
                resuelto_por = COALESCE(?, resuelto_por),
                fecha_resolucion = CASE WHEN ? = 'INCIDENCIA_RESUELTA' THEN NOW() ELSE fecha_resolucion END
            WHERE id = ?
        `;

        await connection.query(updateCabeceraSql, [
            estatus_incidencia || null,
            tipo_resolucion || null,
            folio_nota_credito || null,
            monto_nota_credito !== undefined && monto_nota_credito !== null && monto_nota_credito !== '' ? Number(monto_nota_credito) : null,
            comentarios_resolucion || null,
            resuelto_por || null,
            estatus_incidencia,
            id
        ]);

        // Si se enviaron partidas editadas
        if (partidas && Array.isArray(partidas)) {
            for (const p of partidas) {
                if (p.id) {
                    await connection.query(
                        `UPDATE recepciones_facturas_partidas
                         SET clave_interna = COALESCE(?, clave_interna),
                             estatus_resolucion = COALESCE(?, estatus_resolucion),
                             comentarios_comprador = COALESCE(?, comentarios_comprador)
                         WHERE id = ? AND recepcion_id = ?`,
                        [
                            p.clave_interna || null,
                            p.estatus_resolucion || null,
                            p.comentarios_comprador || null,
                            p.id,
                            id
                        ]
                    );
                }
            }
        }

        // 3. Generación y registro automático de eventos en la bitácora para trazabilidad
        const estatusAnterior = facturaActual.estatus_incidencia || 'PENDIENTE';
        const estatusNuevo = estatus_incidencia || estatusAnterior;

        let eventoGenerado = null;

        if (estatusNuevo === 'EN_ACLARACION' && estatusAnterior !== 'EN_ACLARACION') {
            // Evento: Se comenzó a gestionar la incidencia con el proveedor
            let detalleTexto = `[EVENTO: INICIO DE GESTIÓN] Se comenzó a gestionar la aclaración de la incidencia con el proveedor.`;
            if (tipo_resolucion) detalleTexto += ` Solución preliminar: ${tipo_resolucion}.`;
            if (comentarios_resolucion && comentarios_resolucion.trim()) {
                detalleTexto += ` Detalle: ${comentarios_resolucion.trim()}`;
            }
            eventoGenerado = detalleTexto;
        } else if (estatusNuevo === 'INCIDENCIA_RESUELTA') {
            // Evento: Incidencia resuelta
            let detalleTexto = `[EVENTO: INCIDENCIA RESUELTA] La incidencia ha sido resuelta exitosamente.`;
            if (tipo_resolucion) detalleTexto += ` Solución: ${tipo_resolucion}.`;
            if (folio_nota_credito) detalleTexto += ` Folio NC: ${folio_nota_credito}.`;
            if (monto_nota_credito !== undefined && monto_nota_credito !== null && monto_nota_credito !== '') {
                detalleTexto += ` Monto bonificado: $${Number(monto_nota_credito).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN.`;
            }
            if (comentarios_resolucion && comentarios_resolucion.trim()) {
                detalleTexto += ` Acuerdo comercial: ${comentarios_resolucion.trim()}`;
            }
            eventoGenerado = detalleTexto;
        } else if (comentarios_resolucion && comentarios_resolucion.trim()) {
            // Actualización intermedia
            eventoGenerado = `[SEGUIMIENTO] ${tipo_resolucion ? `Tipo: ${tipo_resolucion}. ` : ''}${folio_nota_credito ? `NC: ${folio_nota_credito}. ` : ''}${comentarios_resolucion.trim()}`;
        }

        if (eventoGenerado) {
            await connection.query(
                `INSERT INTO recepciones_bitacora_seguimiento (recepcion_id, usuario, comentario) VALUES (?, ?, ?)`,
                [id, resuelto_por || 'Comprador', eventoGenerado]
            );
        }

        // Si se incluye una nota adicional explícita para la bitácora
        if (nota_bitacora && nota_bitacora.trim() !== '') {
            await connection.query(
                `INSERT INTO recepciones_bitacora_seguimiento (recepcion_id, usuario, comentario) VALUES (?, ?, ?)`,
                [id, resuelto_por || 'Comprador', nota_bitacora.trim()]
            );
        }

        await connection.commit();
        return { success: true, id, estatus_incidencia: estatusNuevo };
    } catch (error) {
        await connection.rollback();
        console.error("Error en recepcionRepository.actualizarSeguimientoIncidencia:", error);
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    createRecepcion,
    findFacturaExistente,
    deleteRecepcion,
    getPendientesBySucursal,
    getRecepcionDetalleById,
    marcarEnRecepcion,
    finalizarRecepcion,
    getMonitoreoCompras,
    marcarOCGenerada,
    guardarProgresoRecepcion,
    guardarFotoEvidencia,
    getFotoBlobById,
    deleteFotoById,
    agregarNotaBitacora,
    getBitacoraByRecepcionId,
    actualizarSeguimientoIncidencia
};

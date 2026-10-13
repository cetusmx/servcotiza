const recepcionRepository = require('../repositories/recepcionRepository');

/**
 * Valida y procesa la creación de una recepción con sus partidas.
 */
const crearRecepcion = async (data) => {
    const {
        folio_factura,
        uuid_sat,
        rfc_proveedor,
        nombre_proveedor,
        nombre_receptor,
        rfc_receptor,
        sucursal_destino,
        almacen_sae,
        fecha_factura,
        subido_por,
        observaciones_generales,
        xml_original,
        partidas
    } = data;

    if (!folio_factura || !rfc_proveedor || !nombre_proveedor || !sucursal_destino) {
        throw new Error("Faltan campos obligatorios: folio_factura, rfc_proveedor, nombre_proveedor, sucursal_destino.");
    }

    if (!partidas || !Array.isArray(partidas) || partidas.length === 0) {
        throw new Error("La recepción debe contener al menos una partida en el arreglo 'partidas'.");
    }

    // 1. Validar que la factura no esté previamente registrada (evitar duplicados)
    const existente = await recepcionRepository.findFacturaExistente({
        uuid_sat,
        folio_factura,
        rfc_proveedor
    });

    if (existente) {
        const coincidenciaPor = (uuid_sat && existente.uuid_sat && existente.uuid_sat.trim().toLowerCase() === uuid_sat.trim().toLowerCase())
            ? `el UUID SAT (${uuid_sat})`
            : `el Folio (${folio_factura}) y RFC del proveedor (${rfc_proveedor})`;

        const fechaFormateada = existente.fecha_subida ? new Date(existente.fecha_subida).toLocaleDateString() : '';
        const error = new Error(`La factura ya está registrada en el sistema con ${coincidenciaPor}. Sucursal destino: ${existente.sucursal_destino}, Estatus: ${existente.estatus}${fechaFormateada ? `, Fecha: ${fechaFormateada}` : ''}.`);
        error.statusCode = 409;
        error.facturaExistente = existente;
        throw error;
    }

    // Fallback: Si no vienen receptor o rfc_receptor, intentar extraerlos del XML original
    let finalNombreReceptor = nombre_receptor || null;
    let finalRfcReceptor = rfc_receptor || null;
    if ((!finalNombreReceptor || !finalRfcReceptor) && xml_original) {
        try {
            const matchNombre = xml_original.match(/<[^:]*:Receptor[^>]*Nombre=["']([^"']+)["']/i) ||
                                xml_original.match(/Nombre=["']([^"']+)["'][^>]*<[^:]*:Receptor/i);
            const matchRfc = xml_original.match(/<[^:]*:Receptor[^>]*Rfc=["']([^"']+)["']/i);
            if (!finalNombreReceptor && matchNombre) finalNombreReceptor = matchNombre[1];
            if (!finalRfcReceptor && matchRfc) finalRfcReceptor = matchRfc[1];
        } catch (e) {
            console.warn("No se pudo extraer receptor del XML en recepcionService:", e);
        }
    }

    // Calcular totales si no vienen provistos
    const total_partidas = data.total_partidas || partidas.length;
    let total_piezas_facturadas = Number(data.total_piezas_facturadas || 0);

    if (!total_piezas_facturadas) {
        total_piezas_facturadas = partidas.reduce(
            (acc, curr) => acc + Number(curr.cantidad_facturada || 0),
            0
        );
    }

    const cabecera = {
        folio_factura,
        uuid_sat,
        rfc_proveedor,
        nombre_proveedor,
        nombre_receptor: finalNombreReceptor,
        rfc_receptor: finalRfcReceptor,
        sucursal_destino,
        almacen_sae,
        fecha_factura,
        subido_por,
        total_partidas,
        total_piezas_facturadas,
        total_piezas_recibidas: 0,
        tiene_incidencias: 0,
        observaciones_generales,
        xml_original,
        estatus: 'PENDIENTE'
    };

    const recepcionId = await recepcionRepository.createRecepcion(cabecera, partidas);
    return {
        id: recepcionId,
        folio_factura,
        sucursal_destino,
        estatus: 'PENDIENTE',
        total_partidas,
        total_piezas_facturadas
    };
};

/**
 * Obtiene las facturas pendientes para una sucursal dada.
 */
const getPendientes = async (sucursal) => {
    return await recepcionRepository.getPendientesBySucursal(sucursal);
};

/**
 * Obtiene el detalle de la factura con sus partidas.
 * Opcionalmente marca el estatus como EN_RECEPCION si está PENDIENTE.
 */
const getDetalle = async (id, marcarEnProceso = false) => {
    const detalle = await recepcionRepository.getRecepcionDetalleById(id);
    if (!detalle) {
        return null;
    }

    if (marcarEnProceso && detalle.estatus === 'PENDIENTE') {
        await recepcionRepository.marcarEnRecepcion(id);
        detalle.estatus = 'EN_RECEPCION';
    }

    return detalle;
};

/**
 * Finaliza el proceso de recepción física en sucursal.
 */
const finalizarRecepcion = async (id, { recibido_por, observaciones_generales, partidas, fotos }) => {
    if (!partidas || !Array.isArray(partidas)) {
        throw new Error("Se requiere un arreglo 'partidas' con los resultados del conteo.");
    }

    // Normalizar estatus de cada partida si no viene especificado
    const partidasNormalizadas = partidas.map(p => {
        let estatus = p.estatus_partida;
        if (!estatus) {
            const facturada = Number(p.cantidad_facturada || 0);
            const recibida = Number(p.cantidad_recibida || 0);
            const obs = p.observacion || '';
            if (obs.includes('[Incorrecto]')) {
                estatus = 'INCORRECTO';
            } else if (obs.includes('[Dañado]')) {
                estatus = 'DANADA';
            } else if (obs.includes('[Faltante]')) {
                estatus = 'INCOMPLETA';
            } else if (obs.includes('[Otra]')) {
                estatus = 'OTRA';
            } else if (recibida === facturada) {
                estatus = 'COMPLETA';
            } else if (recibida === 0) {
                estatus = 'NO_RECIBIDA';
            } else {
                estatus = 'INCOMPLETA';
            }
        }
        return {
            ...p,
            estatus_partida: estatus
        };
    });

    return await recepcionRepository.finalizarRecepcion(id, {
        recibido_por,
        observaciones_generales,
        partidas: partidasNormalizadas,
        fotos
    });
};

/**
 * Listado de facturas para monitoreo por compras.
 */
const getMonitoreoCompras = async (filtros) => {
    return await recepcionRepository.getMonitoreoCompras(filtros);
};

/**
 * Marca una factura como OC_GENERADA.
 */
const cerrarOC = async (id) => {
    const updated = await recepcionRepository.marcarOCGenerada(id);
    if (!updated) {
        throw new Error(`No se encontró la recepción con ID ${id} o no pudo ser actualizada.`);
    }
    return { id, estatus: 'OC_GENERADA' };
};

/**
 * Guarda el progreso parcial del conteo sin finalizarlo.
 */
const guardarProgreso = async (id, { partidas }) => {
    return await recepcionRepository.guardarProgresoRecepcion(id, { partidas });
};

/**
 * Valida si una factura ya existe en el sistema.
 */
const validarExistente = async ({ uuid_sat, folio_factura, rfc_proveedor }) => {
    return await recepcionRepository.findFacturaExistente({
        uuid_sat,
        folio_factura,
        rfc_proveedor
    });
};

/**
 * Elimina una recepción física y sus partidas asociadas.
 */
const eliminarRecepcion = async (id) => {
    if (!id) {
        throw new Error("El ID de la recepción es requerido.");
    }
    const facturaEliminada = await recepcionRepository.deleteRecepcion(id);
    if (!facturaEliminada) {
        const error = new Error(`No se encontró la recepción con ID ${id}.`);
        error.statusCode = 404;
        throw error;
    }
    return facturaEliminada;
};

/**
 * Guarda una foto de evidencia para una recepción o partida.
 */
const guardarFotoEvidencia = async ({ recepcion_id, partida_id, nombre_archivo, mime_type, tamano_bytes, foto_base64, subido_por }) => {
    if (!recepcion_id || !foto_base64) {
        throw new Error("Se requiere recepcion_id y foto_base64 para guardar evidencia.");
    }
    const buffer = Buffer.from(foto_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const fotoId = await recepcionRepository.guardarFotoEvidencia({
        recepcion_id,
        partida_id: partida_id || null,
        nombre_archivo: nombre_archivo || 'evidencia.jpg',
        mime_type: mime_type || 'image/jpeg',
        tamano_bytes: tamano_bytes || buffer.length,
        foto_buffer: buffer,
        subido_por: subido_por || null
    });
    return { id: fotoId, recepcion_id, partida_id };
};

/**
 * Obtiene el blob binario de una foto de evidencia.
 */
const getFotoBlob = async (id) => {
    const foto = await recepcionRepository.getFotoBlobById(id);
    if (!foto) {
        const error = new Error(`Foto con ID ${id} no encontrada.`);
        error.statusCode = 404;
        throw error;
    }
    return foto;
};

/**
 * Elimina una foto de evidencia.
 */
const deleteFoto = async (id) => {
    const deleted = await recepcionRepository.deleteFotoById(id);
    if (!deleted) {
        const error = new Error(`No se encontró la foto con ID ${id} para eliminar.`);
        error.statusCode = 404;
        throw error;
    }
    return { success: true, id };
};

/**
 * Agrega una nota de seguimiento a la bitácora.
 */
const agregarNotaBitacora = async (recepcion_id, { usuario, comentario }) => {
    if (!recepcion_id || !comentario || comentario.trim() === '') {
        throw new Error("Se requiere recepcion_id y un comentario válido.");
    }
    const id = await recepcionRepository.agregarNotaBitacora(recepcion_id, { usuario, comentario: comentario.trim() });
    return { id, recepcion_id, usuario, comentario };
};

/**
 * Obtiene la bitácora de seguimiento de una recepción.
 */
const getBitacora = async (recepcion_id) => {
    return await recepcionRepository.getBitacoraByRecepcionId(recepcion_id);
};

/**
 * Actualiza el estatus comercial de la incidencia y guarda la resolución.
 */
const actualizarSeguimientoIncidencia = async (id, data) => {
    if (!id) {
        throw new Error("El ID de la recepción es requerido.");
    }
    return await recepcionRepository.actualizarSeguimientoIncidencia(id, data);
};

module.exports = {
    crearRecepcion,
    validarExistente,
    eliminarRecepcion,
    getPendientes,
    getDetalle,
    finalizarRecepcion,
    getMonitoreoCompras,
    cerrarOC,
    guardarProgreso,
    guardarFotoEvidencia,
    getFotoBlob,
    deleteFoto,
    agregarNotaBitacora,
    getBitacora,
    actualizarSeguimientoIncidencia
};

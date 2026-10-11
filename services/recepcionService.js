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
const finalizarRecepcion = async (id, { recibido_por, observaciones_generales, partidas }) => {
    if (!partidas || !Array.isArray(partidas)) {
        throw new Error("Se requiere un arreglo 'partidas' con los resultados del conteo.");
    }

    // Normalizar estatus de cada partida si no viene especificado
    const partidasNormalizadas = partidas.map(p => {
        let estatus = p.estatus_partida;
        if (!estatus) {
            const facturada = Number(p.cantidad_facturada || 0);
            const recibida = Number(p.cantidad_recibida || 0);
            if (recibida === facturada) {
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
        partidas: partidasNormalizadas
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

module.exports = {
    crearRecepcion,
    getPendientes,
    getDetalle,
    finalizarRecepcion,
    getMonitoreoCompras,
    cerrarOC,
    guardarProgreso
};

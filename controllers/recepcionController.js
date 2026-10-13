const { getProductosRecepcion: fetchProductosRecepcion } = require('../services/firebirdService');
const recepcionService = require('../services/recepcionService');

/**
 * Proxy puente hacia Firebird para consultar equivalencias de claves
 * POST /recepcion/productos o /api/v1/recepcion/productos
 */
const getProductosRecepcion = async (req, res) => {
    try {
        const { rfc, claves_proveedor } = req.body;

        if (!rfc || !claves_proveedor || !Array.isArray(claves_proveedor)) {
            return res.status(400).json({ 
                error: "Parámetros inválidos. Se requiere 'rfc' (string) y 'claves_proveedor' (array)." 
            });
        }

        const data = await fetchProductosRecepcion(rfc, claves_proveedor);
        res.status(200).json(data);
    } catch (error) {
        console.error("Error en getProductosRecepcion (Controller):", error);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ 
            error: "Error interno al procesar la solicitud de productos para recepción", 
            details: error.message 
        });
    }
};

/**
 * POST /api/v1/recepcion/crear
 * Sube datos de la factura XML, crea la cabecera y desglosa partidas asignando sucursal destino.
 */
const crearRecepcion = async (req, res) => {
    try {
        const resultado = await recepcionService.crearRecepcion(req.body);
        res.status(201).json({
            success: true,
            message: "Recepción creada exitosamente",
            data: resultado
        });
    } catch (error) {
        console.error("Error en recepcionController.crearRecepcion:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: "Factura ya registrada",
                details: "Esta factura ya se encuentra registrada en el sistema."
            });
        }
        const statusCode = error.statusCode || 400;
        res.status(statusCode).json({
            error: statusCode === 409 ? "Factura ya registrada" : "Error al registrar la recepción",
            details: error.message,
            facturaExistente: error.facturaExistente || null
        });
    }
};

/**
 * GET /api/v1/recepcion/pendientes?sucursal=X
 * Lista las facturas que esa sucursal tiene pendientes por recibir.
 */
const getPendientes = async (req, res) => {
    try {
        const { sucursal } = req.query;
        const facturas = await recepcionService.getPendientes(sucursal);
        res.status(200).json(facturas);
    } catch (error) {
        console.error("Error en recepcionController.getPendientes:", error);
        res.status(500).json({
            error: "Error interno al consultar recepciones pendientes",
            details: error.message
        });
    }
};

/**
 * GET /api/v1/recepcion/:id/detalle
 * Trae la factura completa con todas sus partidas para escanear o revisar incidencias.
 */
const getDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        const { iniciar } = req.query; // Permite pasar ?iniciar=true para cambiar a EN_RECEPCION

        const detalle = await recepcionService.getDetalle(id, iniciar === 'true');
        if (!detalle) {
            return res.status(404).json({
                error: `No se encontró la recepción con ID ${id}`
            });
        }

        res.status(200).json(detalle);
    } catch (error) {
        console.error("Error en recepcionController.getDetalle:", error);
        res.status(500).json({
            error: "Error interno al consultar el detalle de la recepción",
            details: error.message
        });
    }
};

/**
 * POST /api/v1/recepcion/:id/finalizar
 * Envía el conteo real, observaciones y cambia el estatus a RECIBIDO_COMPLETO o RECIBIDO_CON_INCIDENCIA.
 */
const finalizarRecepcion = async (req, res) => {
    try {
        const { id } = req.params;
        const { recibido_por, observaciones_generales, partidas, fotos } = req.body;

        const resultado = await recepcionService.finalizarRecepcion(id, {
            recibido_por,
            observaciones_generales,
            partidas,
            fotos
        });

        res.status(200).json({
            success: true,
            message: "Recepción finalizada con éxito",
            data: resultado
        });
    } catch (error) {
        console.error("Error en recepcionController.finalizarRecepcion:", error);
        res.status(400).json({
            error: "Error al finalizar la recepción",
            details: error.message
        });
    }
};

/**
 * GET /api/v1/recepcion/monitoreo-compras
 * Lista todas las facturas con su estado para saber a cuáles ya se les puede generar OC.
 */
const getMonitoreoCompras = async (req, res) => {
    try {
        const filtros = {
            sucursal: req.query.sucursal,
            estatus: req.query.estatus,
            rfc: req.query.rfc
        };

        const facturas = await recepcionService.getMonitoreoCompras(filtros);
        res.status(200).json(facturas);
    } catch (error) {
        console.error("Error en recepcionController.getMonitoreoCompras:", error);
        res.status(500).json({
            error: "Error interno al consultar el monitoreo de compras",
            details: error.message
        });
    }
};

/**
 * PUT /api/v1/recepcion/:id/cerrar-oc
 * Marca la factura como OC_GENERADA una vez descargado el archivo .MOD.
 */
const cerrarOC = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await recepcionService.cerrarOC(id);
        res.status(200).json({
            success: true,
            message: "Factura cerrada y marcada como OC_GENERADA exitosamente",
            data: resultado
        });
    } catch (error) {
        console.error("Error en recepcionController.cerrarOC:", error);
        res.status(400).json({
            error: "Error al cerrar la recepción",
            details: error.message
        });
    }
};

/**
 * PUT /api/v1/recepcion/:id/progreso
 * Guarda el progreso parcial de las partidas recibidas y pendientes.
 */
const guardarProgreso = async (req, res) => {
    try {
        const { id } = req.params;
        const { partidas } = req.body;

        const resultado = await recepcionService.guardarProgreso(id, { partidas });
        res.status(200).json({
            success: true,
            message: "Progreso guardado exitosamente",
            data: resultado
        });
    } catch (error) {
        console.error("Error en recepcionController.guardarProgreso:", error);
        res.status(400).json({
            error: "Error al guardar progreso de la recepción",
            details: error.message
        });
    }
};

/**
 * GET /api/v1/recepcion/validar-existente?uuid=X&folio=Y&rfc=Z
 * Valida si una factura ya fue registrada en el sistema.
 */
const validarExistente = async (req, res) => {
    try {
        const { uuid, folio, rfc } = req.query;
        if (!folio && !uuid) {
            return res.status(400).json({ error: "Debe proveer 'uuid' o 'folio' y 'rfc' para validar." });
        }
        const existente = await recepcionService.validarExistente({
            uuid_sat: uuid,
            folio_factura: folio,
            rfc_proveedor: rfc
        });
        res.status(200).json({
            existe: Boolean(existente),
            factura: existente || null
        });
    } catch (error) {
        console.error("Error en recepcionController.validarExistente:", error);
        res.status(500).json({ error: "Error al validar existencia de la factura", details: error.message });
    }
};

/**
 * DELETE /api/v1/recepcion/:id
 * Elimina una recepción física y sus partidas (por error de asignación o subida).
 */
const eliminarRecepcion = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await recepcionService.eliminarRecepcion(id);
        res.status(200).json({
            success: true,
            message: `Factura ${resultado.folio_factura} eliminada exitosamente`,
            data: resultado
        });
    } catch (error) {
        console.error("Error en recepcionController.eliminarRecepcion:", error);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: "Error al eliminar la recepción",
            details: error.message
        });
    }
};

/**
 * GET /api/v1/recepcion/evidencias/:fotoId
 * Transmite el archivo binario de la imagen (blob) con su mimetype correspondiente.
 */
const getFotoEvidencia = async (req, res) => {
    try {
        const { fotoId } = req.params;
        const foto = await recepcionService.getFotoBlob(fotoId);

        res.setHeader('Content-Type', foto.mime_type || 'image/jpeg');
        res.setHeader('Content-Length', foto.foto_blob.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 1 día
        res.end(foto.foto_blob);
    } catch (error) {
        console.error("Error en recepcionController.getFotoEvidencia:", error);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ error: "Error al obtener foto", details: error.message });
    }
};

/**
 * POST /api/v1/recepcion/:id/evidencias
 * Sube una foto de evidencia para una recepción o partida.
 */
const subirFotoEvidencia = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await recepcionService.guardarFotoEvidencia({
            recepcion_id: id,
            ...req.body
        });
        res.status(201).json({
            success: true,
            message: "Foto de evidencia guardada exitosamente",
            data: resultado
        });
    } catch (error) {
        console.error("Error en recepcionController.subirFotoEvidencia:", error);
        res.status(400).json({ error: "Error al guardar evidencia", details: error.message });
    }
};

/**
 * DELETE /api/v1/recepcion/evidencias/:fotoId
 * Elimina una foto de evidencia.
 */
const eliminarFotoEvidencia = async (req, res) => {
    try {
        const { fotoId } = req.params;
        const resultado = await recepcionService.deleteFoto(fotoId);
        res.status(200).json({ success: true, message: "Foto eliminada exitosamente", data: resultado });
    } catch (error) {
        console.error("Error en recepcionController.eliminarFotoEvidencia:", error);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ error: "Error al eliminar foto", details: error.message });
    }
};

/**
 * PUT /api/v1/recepcion/:id/seguimiento-incidencia
 * Actualiza el estatus comercial de la incidencia, datos de resolución (NC, reposición) y partidas.
 */
const actualizarSeguimientoIncidencia = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await recepcionService.actualizarSeguimientoIncidencia(id, req.body);
        res.status(200).json({
            success: true,
            message: "Seguimiento de incidencia actualizado exitosamente",
            data: resultado
        });
    } catch (error) {
        console.error("Error en recepcionController.actualizarSeguimientoIncidencia:", error);
        res.status(400).json({ error: "Error al actualizar seguimiento", details: error.message });
    }
};

/**
 * POST /api/v1/recepcion/:id/bitacora
 * Agrega una nota de seguimiento a la bitácora de la recepción.
 */
const agregarNotaBitacora = async (req, res) => {
    try {
        const { id } = req.params;
        const { usuario, comentario } = req.body;
        const resultado = await recepcionService.agregarNotaBitacora(id, { usuario, comentario });
        res.status(201).json({
            success: true,
            message: "Nota agregada a la bitácora",
            data: resultado
        });
    } catch (error) {
        console.error("Error en recepcionController.agregarNotaBitacora:", error);
        res.status(400).json({ error: "Error al agregar nota a la bitácora", details: error.message });
    }
};

/**
 * GET /api/v1/recepcion/:id/bitacora
 * Obtiene la bitácora de seguimiento de una recepción.
 */
const getBitacora = async (req, res) => {
    try {
        const { id } = req.params;
        const bitacora = await recepcionService.getBitacora(id);
        res.status(200).json(bitacora);
    } catch (error) {
        console.error("Error en recepcionController.getBitacora:", error);
        res.status(500).json({ error: "Error al consultar bitácora", details: error.message });
    }
};

module.exports = {
    getProductosRecepcion,
    crearRecepcion,
    validarExistente,
    eliminarRecepcion,
    getPendientes,
    getDetalle,
    finalizarRecepcion,
    getMonitoreoCompras,
    cerrarOC,
    guardarProgreso,
    getFotoEvidencia,
    subirFotoEvidencia,
    eliminarFotoEvidencia,
    actualizarSeguimientoIncidencia,
    agregarNotaBitacora,
    getBitacora
};

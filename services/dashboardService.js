const inventoryRepo = require('../repositories/inventoryRepository');
const firebirdService = require('../services/firebirdService');

/**
 * Orquestación de la métrica de Asertividad Cíclica.
 * Combina datos locales de productos contados con el análisis de la API externa.
 */
const getAsertividadCiclica = async (inventarioId, localInventarioId) => {
    localInventarioId = localInventarioId || inventarioId;

    // 1. Obtener productos contados localmente para ese inventario
    const productosLocales = await inventoryRepo.getContadosByInventario(localInventarioId);

    if (productosLocales.length === 0) {
        return [];
    }

    // 2. Extraer solo las claves para la API externa
    const claves = productosLocales.map(p => (p.Clave || '').trim());

    // 3. Consultar API externa (Firebird)
    let dataExterna = [];
    try {
        dataExterna = await firebirdService.getAsertividadCiclica(inventarioId, claves);
    } catch (error) {
        dataExterna = []; // Si Firebird falla, continuamos con el universo local (sin asertivididad)
    }

    console.log('📋 [ASERTIVIDAD] Primeros 10 productos CRUDOS de Firebird (sin procesar):');
    console.log(JSON.stringify(dataExterna.slice(0, 10), null, 2));

    // 3.5. Obtener el almacén del inventario (tabla Inventarios) y luego la rotación
    const almacenRaw = await inventoryRepo.getAlmacenByInventario(localInventarioId);
    const almacen = almacenRaw != null ? String(almacenRaw).trim() : '';

    let rotaciones = {};
    if (almacen) {
        try {
            rotaciones = await inventoryRepo.getRotacionesByClaveAlmacen(claves, [almacen]);
        } catch (error) {
            // Si falla la consulta de rotación, continuamos sin ese campo
        }
    }

    // 4. Combinar la información recorriendo TODO el universo del inventario
    // (productosLocales) para que ROTACION se agregue a cada producto,
    // independientemente de si Firebird devolvió movimiento (REFER).
    const firebirdPorClave = {};
    for (const item of dataExterna) {
        firebirdPorClave[(item.CVE_ART || '').trim()] = item;
    }

    const resultadoCombinado = productosLocales.map(local => {
        const clave = (local.Clave || '').trim();
        const fb = firebirdPorClave[clave];

        const rotacionKey = `${clave}|${almacen}`;

        return {
            ...(fb || {}),
            CVE_ART: clave,
            CANT_CONTADA: local.Existencia,
            DESCRIPCION_LOCAL: local.Descripcion,
            UNIDAD_LOCAL: local.Unidad,
            AUDITOR: local.Auditor || 'N/A',
            LINEA: local.Linea || 'N/A',
            ROTACION: rotaciones[rotacionKey] ?? null
        };
    });

    console.log(`📊 [ASERTIVIDAD] Total de registros devueltos: ${resultadoCombinado.length}`);
    console.log('📋 [ASERTIVIDAD] Primeros 10 productos devueltos por el endpoint:');
    console.log(JSON.stringify(resultadoCombinado.slice(0, 10), null, 2));
    
    return resultadoCombinado;
};

const calcularHorasActivas = (inicio, fin) => {
    if (!inicio || !fin || fin <= inicio) return 0;

    const HORA_MS = 3600000;
    const CST_OFFSET_MS = -6 * HORA_MS;

    let startMs = inicio.getTime() + CST_OFFSET_MS;
    let endMs = fin.getTime() + CST_OFFSET_MS;

    if (startMs >= endMs) return 0;

    let startOfDay = new Date(startMs);
    startOfDay.setUTCHours(0, 0, 0, 0);
    let cursor = startOfDay.getTime();

    let totalHoras = 0;

    while (cursor < endMs) {
        let dow = new Date(cursor).getUTCDay();

        if (dow === 0) {
            cursor += 24 * HORA_MS;
            continue;
        }

        let workFin = (dow === 6) ? 13 : 19;

        let dayBegin = cursor + 9 * HORA_MS;
        let dayEnd = cursor + workFin * HORA_MS;

        let segStart = Math.max(startMs, dayBegin);
        let segEnd = Math.min(endMs, dayEnd);

        if (segEnd > segStart) {
            totalHoras += (segEnd - segStart) / HORA_MS;
        }

        cursor += 24 * HORA_MS;
    }

    return Math.round(totalHoras * 100) / 100;
};

const getSkuPorHora = async (inventarioId) => {
    const lineas = await inventoryRepo.getLineasConTimestamp(inventarioId);

    if (!lineas || lineas.length === 0) {
        return [];
    }

    const HORA_MS = 3600000;
    const detalle = [];

    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        const current = new Date(linea.createdAt);

        let horasActivas = null;
        let skuHr = null;

        if (i > 0) {
            const prev = new Date(lineas[i - 1].createdAt);
            const horasLaborales = calcularHorasActivas(prev, current);
            const horasRaw = (current - prev) / HORA_MS;

            if (horasLaborales > 0) {
                horasActivas = horasLaborales;
            } else if (horasRaw > 0.0167) {
                horasActivas = Math.round(horasRaw * 100) / 100;
            }

            if (horasActivas > 0) {
                skuHr = Math.round((linea.productos / horasActivas) * 100) / 100;
            }
        }

        detalle.push({
            linea: linea.Linea,
            productos: linea.productos,
            timestamp: lineas[i].createdAt,
            horasActivas,
            skuHr
        });
    }

    return detalle;
};

module.exports = {
    getAsertividadCiclica,
    getSkuPorHora
};

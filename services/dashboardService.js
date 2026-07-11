const inventoryRepo = require('../repositories/inventoryRepository');
const firebirdService = require('../services/firebirdService');

/**
 * Orquestación de la métrica de Asertividad Cíclica.
 * Combina datos locales de productos contados con el análisis de la API externa.
 */
const getAsertividadCiclica = async (inventarioId) => {
    console.log('\n🔍 [ORQUESTADOR] =========================================');
    console.log(`🔍 [ORQUESTADOR] Iniciando proceso para InventarioID: "${inventarioId}"`);

    // 1. Obtener productos contados localmente para ese inventario
    console.log('⏳ [ORQUESTADOR] Paso 1: Consultando Base de Datos Local (MySQL)...');
    const productosLocales = await inventoryRepo.getContadosByInventario(inventarioId);
    
    console.log(`📦 [ORQUESTADOR] Paso 1 Resultado: ${productosLocales.length} productos locales encontrados.`);
    if (productosLocales.length > 0) {
        console.log('   Ejemplo Local:', productosLocales.slice(0, 2));
    }

    if (productosLocales.length === 0) {
        console.warn('⛔ [ORQUESTADOR] ¡ALERTA! No hay productos locales. Abortando y devolviendo [].');
        console.warn('   👉 Revisa si el InventarioID en MySQL coincide exactamente con "062026-1"');
        return [];
    }

    // 2. Extraer solo las claves para la API externa (Agregamos .trim() por seguridad)
    const claves = productosLocales.map(p => (p.Clave || '').trim());
    console.log(`🔑 [ORQUESTADOR] Paso 2: ${claves.length} claves listas para enviar a Firebird.`);

    // 3. Consultar API externa (Firebird)
    console.log('🚀 [ORQUESTADOR] Paso 3: Llamando a API Firebird (esto puede tardar ~40s)...');
    let dataExterna = [];
    try {
        dataExterna = await firebirdService.getAsertividadCiclica(inventarioId, claves);
        console.log(`🔥 [ORQUESTADOR] Paso 3 Resultado: Firebird devolvió ${dataExterna ? dataExterna.length : 0} registros.`);
        if (dataExterna && dataExterna.length > 0) {
            console.log('   Ejemplo Firebird:', dataExterna.slice(0, 2));
        }
    } catch (error) {
        console.error('❌ [ORQUESTADOR] ¡ERROR CRÍTICO llamando a Firebird!', error.message);
        console.error('   👉 Posible Timeout de Axios. Firebird tardó 44s en responder.');
        return []; // Devolvemos vacío si la API externa falla
    }

    if (!dataExterna || dataExterna.length === 0) {
        console.warn('⛔ [ORQUESTADOR] ¡ALERTA! Firebird no devolvió datos.');
        return [];
    }

    // 4. Combinar la información
    console.log('🔗 [ORQUESTADOR] Paso 4: Cruzando datos locales con Firebird...');
    const resultadoCombinado = dataExterna.map(itemExterno => {
        // 🔧 CORRECCIÓN: Usamos .trim() en ambos lados para evitar que los espacios 
        // de MySQL (CHAR) rompan el match con Firebird (ya limpio).
        const local = productosLocales.find(p => (p.Clave || '').trim() === (itemExterno.CVE_ART || '').trim());

        return {
            ...itemExterno,
            CANT_CONTADA: local ? local.Existencia : 0, 
            DESCRIPCION_LOCAL: local ? local.Descripcion : '',
            UNIDAD_LOCAL: local ? local.Unidad : '',
            AUDITOR: local ? local.Auditor : 'N/A',
            LINEA: local ? local.Linea : 'N/A'
        };
    });

    console.log(`✅ [ORQUESTADOR] ¡ÉXITO! Enviando ${resultadoCombinado.length} registros al Frontend.`);
    console.log('==========================================================\n');
    
    return resultadoCombinado;
};

module.exports = {
    getAsertividadCiclica
};

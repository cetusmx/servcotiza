const inventoryRepo = require('../repositories/inventoryRepository');
const firebirdService = require('../services/firebirdService');

/**
 * Orquestación de la métrica de Asertividad Cíclica.
 * Combina datos locales de productos contados con el análisis de la API externa.
 */
const getAsertividadCiclica = async (inventarioId) => {
    // 1. Obtener productos contados localmente para ese inventario
    const productosLocales = await inventoryRepo.getContadosByInventario(inventarioId);
    
    if (productosLocales.length === 0) {
        return [];
    }

    // 2. Extraer solo las claves para la API externa
    const claves = productosLocales.map(p => p.Clave);

    // 3. Consultar API externa para obtener el análisis de asertividad (Merma, Ajuste, etc.)
    const dataExterna = await firebirdService.getAsertividadCiclica(inventarioId, claves);

    // 4. Combinar la información
    // Usamos el resultado de la API externa como base y le añadimos datos locales útiles
    const resultadoCombinado = dataExterna.map(itemExterno => {
        // Buscamos el registro local correspondiente
        const local = productosLocales.find(p => p.Clave === itemExterno.CVE_ART);
        
        return {
            ...itemExterno,
            CANT_CONTADA: local ? local.Existencia : 0, // Lo que el auditor contó físicamente
            DESCRIPCION_LOCAL: local ? local.Descripcion : '',
            UNIDAD_LOCAL: local ? local.Unidad : '',
            AUDITOR: local ? local.Auditor : 'N/A',
            LINEA: local ? local.Linea : 'N/A'
        };
    });

    return resultadoCombinado;
};

module.exports = {
    getAsertividadCiclica
};

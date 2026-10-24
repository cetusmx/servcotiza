const axios = require('axios');
require('dotenv').config();

// Instancia centralizada con API Key
const firebirdApi = axios.create({
    baseURL: process.env.FIREBIRD_API_URL,
    headers: {
        'x-api-key': process.env.FIREBIRD_API_KEY,
        'Content-Type': 'application/json'
    }
});

const getClavesProveedor = async (data) => {
    try {
        const response = await firebirdApi.post('/api/getclavesprovee', data);
        // Devuelve: { cve_clpv: "...", partidas: [...] }
        return response.data; 
    } catch (error) {
        console.error("Error en firebirdService (POST):", error.message);
        throw error;
    }
};

const getClaveUnitaria = async (rfc, clave) => {
    try {
        const response = await firebirdApi.get(`/api/getclavesprovee?rfc=${rfc}&clave=${clave}`);
        // Devuelve: { claveprove: "...", clave: "...", origen: "..." }
        return response.data;
    } catch (error) {
        console.error("Error en firebirdService (GET):", error.message);
        throw error;
    }
};

const getAlmacenes = async () => {
    try {
        const response = await firebirdApi.get('/api/catalogos/almacenes');
        return response.data; // Se transfiere la respuesta sin cambios
    } catch (error) {
        console.error("Error en firebirdService (getAlmacenes):", error.message);
        throw error;
    }
};

const getAsertividadCiclica = async (refer, productos) => {
    try {
        const response = await firebirdApi.post('/api/dashboard-inventarios/asertividad-ciclico', {
            refer,
            productos
        });
        return response.data;
    } catch (error) {
        console.error("Error en firebirdService (getAsertividadCiclica):", error.message);
        throw error;
    }
};

const getProductosRecepcion = async (rfc, claves_proveedor) => {
    try {
        const response = await firebirdApi.post('/api/productos-recepcion', {
            rfc,
            claves_proveedor
        });
        return response.data;
    } catch (error) {
        console.error("Error en firebirdService (getProductosRecepcion):", error.message);
        throw error;
    }
};

const getFamiliaByClave = async (clave) => {
    try {
        const cleanClave = String(clave || '').trim();
        const response = await firebirdApi.get('/api/productos', {
            params: { search: cleanClave, limit: 10 }
        });
        const lista = Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data)
            ? response.data
            : [];
        const exact = lista.find(
            (item) => String(item.CVE_ART || '').trim().toUpperCase() === cleanClave.toUpperCase()
        ) || lista[0];

        return {
            clave: cleanClave,
            familia: exact ? (exact.Familia || '') : '',
            linea: exact ? (exact.LIN_PROD || '') : '',
            genero: exact ? (exact.Genero || '') : ''
        };
    } catch (error) {
        console.error("Error en firebirdService (getFamiliaByClave):", error.message);
        throw error;
    }
};

// Caché ligero en memoria (2 minutos) para evitar descargar 26k registros repetidamente en cada cambio de pestaña
let cacheCatalogoDetallado = null;
let cacheCatalogoTimestamp = 0;
const CACHE_TTL_MS = 2 * 60 * 1000;

const getCatalogoProductosFirebird = async () => {
    try {
        const ahora = Date.now();
        if (cacheCatalogoDetallado && (ahora - cacheCatalogoTimestamp) < CACHE_TTL_MS) {
            return cacheCatalogoDetallado;
        }
        const response = await firebirdApi.get('/productos-detallado');
        const data = Array.isArray(response.data) ? response.data : [];
        cacheCatalogoDetallado = data;
        cacheCatalogoTimestamp = ahora;
        return data;
    } catch (error) {
        console.error("Error en firebirdService (getCatalogoProductosFirebird):", error.message);
        throw error;
    }
};

const getProductosPorLineaFirebird = async (linea) => {
    try {
        const cleanLinea = String(linea || '').trim().toUpperCase();
        const PAGE_LIMIT = 500;

        const [resApiProductos, resFilterPag1] = await Promise.allSettled([
            firebirdApi.get('/api/productos', {
                params: { linea: cleanLinea, page: 1, limit: PAGE_LIMIT }
            }),
            firebirdApi.get('/clavesalternas/filter', {
                params: { linea: cleanLinea, limit: PAGE_LIMIT, offset: 0 }
            })
        ]);

        const mapaLinea = {};
        let familiaDetectada = '';

        const registrarItem = (raw) => {
            const cve = String(raw.CVE_ART ?? raw.clave ?? '').trim().toUpperCase();
            if (!cve) return;
            const prev = mapaLinea[cve] || {};
            const descr = String(raw.DESCR ?? raw.descripcion ?? prev.descripcion ?? '').trim();
            const di = String(raw['Diámetro Interior'] ?? raw.DIAM_INT ?? prev.diametrointerior ?? '').trim();
            const de = String(raw['Diámetro Exterior'] ?? raw.DIAM_EXT ?? prev.diametroexterior ?? '').trim();
            const alt = String(raw.Altura ?? raw.ALTURA ?? prev.altura ?? '').trim();
            const sec = String(raw.Seccion ?? raw.SECCION ?? prev.seccion ?? '').trim();
            const perf = String(raw.Perfil ?? raw.PERFIL ?? prev.perfil ?? '').trim();
            const fam = String(raw.Familia ?? raw.CAT_ECOMM ?? raw.FAMILIA ?? prev.familia ?? '').trim();

            if (!familiaDetectada && fam) {
                familiaDetectada = fam;
            }

            mapaLinea[cve] = {
                clave: cve,
                linea: cleanLinea,
                descripcion: descr,
                diametrointerior: di,
                diametroexterior: de,
                altura: alt,
                seccion: sec,
                perfil: perf,
                familia: fam
            };
        };

        if (resApiProductos.status === 'fulfilled') {
            const dataProd = Array.isArray(resApiProductos.value.data?.data)
                ? resApiProductos.value.data.data
                : Array.isArray(resApiProductos.value.data)
                ? resApiProductos.value.data
                : [];
            dataProd.forEach(registrarItem);
        }

        if (resFilterPag1.status === 'fulfilled') {
            const payload = resFilterPag1.value.data;
            const rows1 = Array.isArray(payload?.data) ? payload.data : [];
            rows1.forEach(registrarItem);

            const totalPages = payload?.pagination?.totalPages || 1;
            if (totalPages > 1) {
                const promesasPaginas = [];
                for (let pag = 2; pag <= totalPages; pag++) {
                    promesasPaginas.push(
                        firebirdApi.get('/clavesalternas/filter', {
                            params: {
                                linea: cleanLinea,
                                limit: PAGE_LIMIT,
                                offset: (pag - 1) * PAGE_LIMIT
                            }
                        })
                    );
                }
                const resPags = await Promise.allSettled(promesasPaginas);
                resPags.forEach((rp) => {
                    if (rp.status === 'fulfilled' && Array.isArray(rp.value.data?.data)) {
                        rp.value.data.data.forEach(registrarItem);
                    }
                });
            }
        }

        return {
            linea: cleanLinea,
            familia: familiaDetectada,
            productos: mapaLinea
        };
    } catch (error) {
        console.error("Error en firebirdService (getProductosPorLineaFirebird):", error.message);
        throw error;
    }
};

module.exports = {
    getClavesProveedor,
    getClaveUnitaria,
    getAlmacenes,
    getAsertividadCiclica,
    getProductosRecepcion,
    getFamiliaByClave,
    getCatalogoProductosFirebird,
    getProductosPorLineaFirebird
};

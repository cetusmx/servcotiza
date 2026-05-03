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

module.exports = { getClavesProveedor, getClaveUnitaria, getAlmacenes };
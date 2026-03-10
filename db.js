const mysql = require('mysql2/promise');

// Configuración del Pool
// El pool maneja múltiples conexiones y las mantiene vivas
const pool = mysql.createPool({
    host: "sealmarket.mx",
    user: "sealmark_cotizauser",
    password: "Trof#4102",
    database: "sealmark_cotizador",
    waitForConnections: true,
    connectionLimit: 10,       // Máximo 10 conexiones simultáneas
    queueLimit: 0,
    idleTimeout: 60000,        // Cierra conexiones inactivas tras 60 seg (evita el error de IO)
    enableKeepAlive: true,     // Mantiene la conexión "despierta"
    keepAliveInitialDelay: 10000
});

module.exports = pool;
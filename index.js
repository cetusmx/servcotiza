require('dotenv').config();
const express = require("express");
const app = express();
const mysql = require("mysql2/promise");
//const cors = require("cors");   //comentar en PRODUCCION
//import { insertarLista } from "./database.js";
var bodyParser = require('body-parser');
const pool = require('./db');

const catalogRoutes = require('./routes/catalogRoutes');

// CONFIGURACIÓN DE CORS --- COMENTAR EN PRODUCCION
/* app.use(cors({
    origin: "http://localhost:3000", // Permite solo a tu frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
})); */
// FIN DE COMENTAR EN PRODUCCION

app.use(express.json({
    type: ['application/json', 'text/plain'],
    limit: '50mb',
    extended: true
}))

app.use('/', catalogRoutes);

//Actualizada
app.post("/insertClaveManualNoRegistrada", async (req, res) => {
    console.log("Cuerpo recibido:", req.body);

    // Mantenemos tus constantes y nombres de variables exactos
    const clave = req.body.clave;
    const sucursal = req.body.sucursal;
    const rfc = req.body.proveedor;
    const factura = req.body.factura;
    const claveProveedor = req.body.claveProveedor;
    const fecha = req.body.fecha;
    const estatus = "Pendiente";
    // const dummy = ""; // Mantengo la lógica original por si la necesitas, aunque no se use en el query

    try {
        // Ejecutamos la inserción usando el pool con async/await
        // Respetamos el orden de tus campos: clave, sucursal, rfc, factura, claveProveedor, estatus, fecha
        await pool.query(
            'INSERT INTO clavesnoregistradas(clave, sucursal, rfc, factura, claveProveedor, estatus, fecha) VALUES(?,?,?,?,?,?,?)',
            [clave, sucursal, rfc, factura, claveProveedor, estatus, fecha]
        );

        // La respuesta se envía SOLO si la base de datos confirmó la inserción
        res.status(200).send("INSERTED");

    } catch (err) {
        console.error("Error en POST /insertClaveManualNoRegistrada:", err);
        
        // Enviamos error estructurado para evitar que la App se quede esperando
        res.status(500).json({ 
            error: "Error interno al registrar clave no registrada", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.put("/actualiza", async (req, res) => {
    console.log("Cuerpo recibido en /actualiza:", req.body);

    const familia = req.body.fa;
    const cambiaron = req.body.cambios || []; // Aseguramos que sea un array

    // Mapeo de valores y nombres de sucursales
    const sucursalesConfig = [
        { nombre: "Durango", margen: req.body.du },
        { nombre: "Fresnillo", margen: req.body.fr },
        { nombre: "Mazatlán", margen: req.body.ma },
        { nombre: "Zacatecas", margen: req.body.za },
        { nombre: "Tecmin", margen: req.body.te },
        { nombre: "Mayorista", margen: req.body.my }
    ];

    const resultados = [];

    try {
        // Procesamos cada sucursal de forma secuencial y segura
        for (const suc of sucursalesConfig) {
            if (cambiaron.includes(suc.nombre)) {
                console.log(`Actualizando margen para ${suc.nombre}: ${suc.margen}`);
                
                const [result] = await pool.query(
                    'UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?', 
                    [suc.margen, suc.nombre, familia]
                );
                
                resultados.push({ sucursal: suc.nombre, status: "updated", affectedRows: result.affectedRows });
            }
        }

        console.log("Resultados finales:", resultados);
        // Ahora sí, enviamos la respuesta cuando todo ha terminado
        res.status(200).json(resultados);

    } catch (err) {
        console.error("Error en PUT /actualiza:", err);
        res.status(500).json({ 
            error: "Error interno al actualizar márgenes por sucursal", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.post("/updateListaPrecios", async (req, res) => {
    console.log("Cuerpo recibido:", req.body);
    
    // Obtenemos una conexión exclusiva para procesar el lote
    const connection = await pool.getConnection();

    try {
        console.log("Iniciando actualización de lista de precios...");

        for (const element of req.body) {
            // Respetamos tus nombres de propiedad originales (PascalCase)
            const clave = element.Clave;
            const precio = element.Precio;
            const sucursal = element.Sucursal;

            console.log(`${clave}-${precio}-${sucursal}`);

            // Ejecutamos el UPDATE esperando la confirmación de la DB
            // SQL: precio=?, clave=?, sucursal=?
            await connection.query(
                'UPDATE precios SET precio=? WHERE clave=? AND sucursal=?', 
                [precio, clave, sucursal]
            );
        }

        // Enviamos respuesta solo cuando el bucle termina con éxito
        res.status(200).send("INSERTED");

    } catch (err) {
        console.error("Error en /updateListaPrecios:", err);
        
        res.status(500).json({ 
            error: "Error interno al actualizar la lista de precios", 
            details: err.message 
        });
    } finally {
        // Liberamos la conexión de vuelta al pool
        connection.release();
    }
});

    //Actualizada
    app.post("/updateMargenes", async (req, res) => {
    console.log("Iniciando actualización masiva de márgenes...");
    
    // Obtenemos una conexión del pool para esta ráfaga de actualizaciones
    const connection = await pool.getConnection();

    try {
        // Usamos for...of para procesar cada elemento de forma ordenada
        for (const element of req.body) {
            const margen = element.margen;
            const familia = element.familia;
            const sucursal = element.sucursal;

            console.log(`Actualizando: ${margen} - ${familia} - ${sucursal}`);

            // Ejecutamos el UPDATE esperando a que termine cada uno
            await connection.query(
                'UPDATE margenes SET margen=? WHERE familia=? AND sucursal=?', 
                [margen, familia, sucursal]
            );
        }

        // Una vez que todos los elementos se procesaron con éxito
        res.status(200).send("INSERTED");

    } catch (err) {
        console.error("Error en POST /updateMargenes:", err);
        
        // Respondemos con error pero mantenemos la API viva
        res.status(500).json({ 
            error: "Error interno al actualizar márgenes", 
            details: err.message 
        });
    } finally {
        // LIBERAR la conexión de vuelta al pool es vital
        connection.release();
    }
});

    //Actualizada
    app.post("/borrarLista", async (req, res) => {
    // Mantenemos la extracción del parámetro sucursal desde req.query
    const sucursal = req.query.sucursal;
    
    console.log(`Intentando borrar lista de precios para sucursal: ${sucursal}`);

    // Validación: Evitamos borrar sin un parámetro claro
    if (!sucursal) {
        return res.status(400).json({ 
            error: "El parámetro 'sucursal' es obligatorio para borrar la lista." 
        });
    }

    try {
        // Ejecutamos el DELETE filtrado por sucursal usando el pool
        await pool.query('DELETE FROM precios WHERE sucursal=?', [sucursal]);

        // Solo enviamos el éxito cuando la base de datos termina
        res.status(200).send("BORRADA");

    } catch (err) {
        console.error("Error en POST /borrarLista:", err);
        
        // Respuesta de error estructurada
        res.status(500).json({ 
            error: "Error interno al intentar borrar la lista de precios", 
            details: err.message 
        });
    }
});


    //Actualizada
    app.get("/borrarMargenes", async (req, res) => {
    // Mantenemos la extracción del parámetro aunque el TRUNCATE no lo use
    const sucursal = req.query.sucursal;
    console.log(`Solicitud para borrar márgenes de: ${sucursal || 'Todas'}`);

    try {
        // Ejecutamos el TRUNCATE usando el pool
        await pool.query('TRUNCATE TABLE margenes');

        // Enviamos respuesta de éxito para que el frontend sepa que terminó
        res.status(200).send("Márgenes borrados correctamente");

    } catch (err) {
        console.error("Error en /borrarMargenes:", err);
        
        // Enviamos el error al cliente para evitar que la petición quede abierta
        res.status(500).json({ 
            error: "Error interno al intentar vaciar la tabla de márgenes", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.post("/insertarSiembra", async (req, res) => {
    console.log("Cuerpo recibido:", req.body);

    // Mantenemos tus constantes y valores predeterminados
    const fecha = req.body.fecha;
    const clave = req.body.clave;
    const familia = "";
    const motivo = "";
    const veces = "";
    const sucursal = req.body.sucursal;
    const observaciones = req.body.observaciones;
    const maximo = req.body.qty;
    const estatus = "Abierta";
    const autorizacion = "Pendiente";

    console.log(`${clave}-${familia}-${motivo}-${veces}-${sucursal}-${observaciones}-${maximo}`);

    try {
        // Ejecutamos la inserción usando el Pool
        // Respetamos el nombre de la tabla 'siembraProds' y el orden de los campos
        await pool.query(
            'INSERT INTO siembraProds(fecha, clave, familia, motivo, veces, observaciones, sucursal, maximo, estatus, autorizacion) VALUES(?,?,?,?,?,?,?,?,?,?)',
            [fecha, clave, familia, motivo, veces, observaciones, sucursal, maximo, estatus, autorizacion]
        );

        // Enviamos la respuesta solo después de que la inserción fue exitosa
        res.status(200).send("INSERTED");

    } catch (err) {
        // Log de error detallado para PM2
        console.error("Error en POST /insertarSiembra:", err);
        
        // Si hay un error, lo enviamos de vuelta pero evitamos que el proceso se cuelgue
        res.status(500).json({ 
            error: "Error interno al insertar en siembraProds", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.post("/insertarLista", async (req, res) => {
    // Obtenemos una conexión específica para esta ráfaga de inserciones
    const connection = await pool.getConnection();

    try {
        console.log("Iniciando inserción masiva en tabla precios...");

        // Usamos for...of en lugar de .map para asegurar que el await funcione correctamente
        for (const element of req.body) {
            const { clave, precio, sucursal } = element;

            console.log(`${clave}-${precio}-${sucursal}`);

            // Insertamos cada registro esperando a que termine antes de seguir con el siguiente
            await connection.query(
                'INSERT INTO precios(clave, precio, sucursal) VALUES(?, ?, ?)', 
                [clave, precio, sucursal]
            );
        }

        // Solo cuando el bucle termina, enviamos la respuesta de éxito
        res.status(200).send("INSERTED");

    } catch (err) {
        console.error("Error en /insertarLista:", err);
        
        // Si hay un error, lo enviamos pero evitamos que el servidor se detenga
        res.status(500).json({ 
            error: "Error interno al insertar la lista de precios", 
            details: err.message 
        });
    } finally {
        // MUY IMPORTANTE: Liberar la conexión al pool
        connection.release();
    }
});

    //Actualizada
    app.get("/getclaves", async (req, res) => {
    // Mantenemos la extracción del parámetro rfc
    const rfc = req.query.rfc;
    console.log("RFC recibido en /getclaves:", rfc);

    // Validación preventiva: Si no hay RFC, no tiene sentido consultar la vista
    if (!rfc) {
        return res.status(400).json({ 
            error: "El parámetro 'rfc' es obligatorio para esta consulta." 
        });
    }

    try {
        // Consultamos la vista respetando el nombre exacto: claveProveeedorView
        // Y los campos: clave, claveprove
        const [rows] = await pool.query(
            "SELECT clave, claveprove FROM claveProveeedorView WHERE rfc COLLATE utf8mb4_unicode_ci = ?", 
            [rfc]
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // Registro del error para monitoreo en PM2
        console.error("Error en GET /getclaves:", err);
        
        // Respuesta de seguridad para evitar que el cliente se quede esperando
        res.status(500).json({ 
            error: "Error interno al obtener las claves del proveedor", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getauditores", async (req, res) => {
    // Mantenemos la recepción del RFC para el log original
    const rfc = req.query.rfc;
    console.log("RFC recibido en /getauditores:", rfc);

    try {
        // Ejecutamos la consulta usando el pool
        // Respetamos la tabla 'Auditores' y los campos 'id' y 'Nombre'
        const [rows] = await pool.query(
            'SELECT id, Nombre FROM Auditores'
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // Log de error para depuración en el servidor
        console.error("Error en GET /getauditores:", err);
        
        // Respuesta controlada para evitar que la App se bloquee
        res.status(500).json({ 
            error: "Error interno al obtener la lista de auditores", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getlineas", async (req, res) => {
    // Mantenemos la recepción del RFC para el log original
    const rfc = req.query.rfc;
    console.log("RFC recibido en /getlineas:", rfc);

    try {
        // Ejecutamos la consulta usando el pool
        // Mantenemos el DISTINCT y el filtro para omitir líneas vacías
        const [rows] = await pool.query(
            "SELECT DISTINCT linea FROM Productos WHERE linea<>''"
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // Log de error para monitoreo en el servidor
        console.error("Error en GET /getlineas:", err);
        
        // Respuesta de error estructurada
        res.status(500).json({ 
            error: "Error interno al obtener las líneas de productos", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getnombresinv", async (req, res) => {
    // Mantenemos la extracción y el log del RFC original
    const rfc = req.query.rfc;
    console.log("RFC recibido en /getnombresinv:", rfc);

    try {
        // Ejecutamos la consulta usando el pool
        // Mantenemos la lógica de obtener IDs únicos de la tabla Inventarios
        const [rows] = await pool.query(
            "SELECT DISTINCT InventarioID FROM Inventarios"
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // Capturamos el error para evitar que el servidor se detenga
        console.error("Error en GET /getnombresinv:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener los nombres de inventario", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getresumeninventarios", async (req, res) => {
    // Mantenemos la extracción del parámetro auditor
    const auditor = req.query.auditor;
    
    console.log("Auditor recibido:", auditor);
    // Log descriptivo de la operación (usando el parámetro de forma segura para el log)
    console.log(`Consultando resumen para Auditor: ${auditor}`);

    // Validación: Si no viene el auditor, respondemos con error 400
    if (!auditor) {
        return res.status(400).json({ 
            error: "El parámetro 'auditor' es obligatorio." 
        });
    }

    try {
        // Ejecutamos la consulta usando el Pool
        // Respetamos los campos: InventarioID, qtyProductos, Ciudad, Almacen, Fecha, qtyLineas, ProgressPorcentage
        const [rows] = await pool.query(
            'SELECT InventarioID, qtyProductos, Ciudad, Almacen, Fecha, qtyLineas, ProgressPorcentage FROM inv_resumen_inventarios_app_view WHERE Auditor=?', 
            [auditor]
        );

        // Enviamos el resultado y mostramos en consola como el original
        console.log(rows);
        res.status(200).json(rows);

    } catch (err) {
        console.error("Error en GET /getresumeninventarios:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener el resumen de inventarios", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getresumeninventariosweb", async (req, res) => {
    // Mantenemos tu log original para monitorear quién consulta
    const auditor = req.query.auditor;
    console.log("Consulta web por auditor:", auditor);

    try {
        // Consultamos la vista respetando exactamente tus campos:
        // InventarioID, qtyProductos, Ciudad, Almacen, Fecha, qtyLineas, ProgressPorcentage, Auditor
        const [rows] = await pool.query(
            'SELECT InventarioID, qtyProductos, Ciudad, Almacen, Fecha, qtyLineas, ProgressPorcentage, Auditor FROM inv_resumen_inventarios_app_view'
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        console.error("Error en GET /getresumeninventariosweb:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener el resumen de inventarios web", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getresumeninventariosgenerales", async (req, res) => {
    console.log("Consultando todos los inventarios generales...");

    try {
        // Ejecutamos la consulta directa al Pool
        // Respetamos la tabla 'InventarioGenerals' y sus campos PascalCase
        const [rows] = await pool.query(
            'SELECT InventarioID, Ciudad, Almacen, Ubicacion, Lineas, Auditor, Fecha FROM InventarioGenerals'
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // Log detallado para depuración en el servidor
        console.error("Error en GET /getresumeninventariosgenerales:", err);
        
        // Respuesta controlada para que la App no se quede en espera infinita
        res.status(500).json({ 
            error: "Error interno al obtener el resumen general de inventarios", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getresumeninventariosgeneralesaudit", async (req, res) => {
    // Mantenemos el parámetro auditor tal cual lo extraes de la query
    const auditor = req.query.auditor;

    // Validación básica: si no hay auditor, evitamos una consulta vacía
    if (!auditor) {
        return res.status(400).json({ 
            error: "El parámetro 'auditor' es requerido para filtrar los inventarios." 
        });
    }

    try {
        // Consultamos la tabla InventarioGenerals respetando tus campos PascalCase
        const [rows] = await pool.query(
            'SELECT InventarioID, Ciudad, Almacen, Ubicacion, Lineas, Auditor, Fecha FROM InventarioGenerals WHERE Auditor=?', 
            [auditor]
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // Capturamos errores para que PM2 no tenga que reiniciar por caídas de red
        console.error("Error en GET /getresumeninventariosgeneralesaudit:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener inventarios generales", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getresumentarjetasini", async (req, res) => {
    // Mantenemos la extracción del parámetro aunque no se use en el query actual
    const auditor = req.query.auditor;

    try {
        // Ejecutamos la consulta a la vista de resumen de tarjetas
        // Respetamos los nombres de campos: Asignados, Completos, Incompletos, Percentage
        const [rows] = await pool.query(
            'SELECT Asignados, Completos, Incompletos, Percentage FROM inv_resumen_tarjetas_inv_app_view'
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // Log de error para depuración en PM2
        console.error("Error en GET /getresumentarjetasini:", err);
        
        // Respuesta de error para evitar que la app se quede esperando
        res.status(500).json({ 
            error: "Error interno al obtener el resumen de tarjetas", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getresumeninventario", async (req, res) => {
    // Mantenemos tus nombres exactos de variables
    const InventarioID = req.query.InventarioID;
    const auditor = req.query.auditor;

    console.log("getResumenInv ", InventarioID, "-", auditor);

    // Validación de parámetros para asegurar una consulta exitosa
    if (!InventarioID || !auditor) {
        return res.status(400).json({ 
            error: "Faltan parámetros: InventarioID y auditor son obligatorios." 
        });
    }

    try {
        // Ejecutamos la consulta a la vista inv_resumen_inventarios_app_view
        // Respetamos los campos exactos: qtyProductos, qtyLineas, ProgressPorcentage, etc.
        const [rows] = await pool.query(
            'SELECT InventarioID, qtyProductos, Ciudad, Almacen, Fecha, qtyLineas, ProgressPorcentage FROM inv_resumen_inventarios_app_view WHERE InventarioID=? AND Auditor=?', 
            [InventarioID, auditor]
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // Manejo de errores profesional para evitar cuelgues de la API
        console.error("Error en GET /getresumeninventario:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener el resumen del inventario", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getlineasinvresumen", async (req, res) => {
    // Mantenemos tus nombres exactos de variables y parámetros de query
    const InventarioID = req.query.InventarioID;
    const auditor = req.query.auditor;

    // Validación preventiva de parámetros
    if (!InventarioID || !auditor) {
        return res.status(400).json({ 
            error: "Faltan parámetros requeridos: InventarioID y auditor son obligatorios." 
        });
    }

    try {
        // Consultamos la vista inv_lineas_app_view respetando todas las columnas originales
        const [rows] = await pool.query(
            'SELECT InventarioID, Linea, qtyProductosLinea, NombreLinea, isCounted, isAdjusted FROM inv_lineas_app_view WHERE InventarioID=? AND Auditor=?', 
            [InventarioID, auditor]
        );

        // Enviamos el resultado al cliente
        res.status(200).json(rows);

    } catch (err) {
        // En caso de error de red o base de datos, capturamos para evitar que la API se caiga
        console.error("Error en GET /getlineasinvresumen:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener el resumen de líneas", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getproductosporlineaeinv", async (req, res) => {
    // Mantenemos tus nombres originales de parámetros
    const InventarioID = req.query.InventarioID;
    const Linea = req.query.Linea;
    const auditor = req.query.auditor;

    console.log("InventarioID:", InventarioID);
    console.log("Linea:", Linea);
    console.log("Auditor:", auditor);

    // Validación para asegurar que los datos necesarios están presentes
    if (!InventarioID || !Linea || !auditor) {
        return res.status(400).json({ 
            error: "Faltan parámetros requeridos: InventarioID, Linea y auditor son obligatorios." 
        });
    }

    try {
        // Usamos exactamente tu consulta SQL y tus nombres de campos
        const [rows] = await pool.query(
            'SELECT InventarioID, Linea, Clave, Descripcion, Unidad FROM Inventarios WHERE InventarioID=? and Linea=? and Auditor=?', 
            [InventarioID, Linea, auditor]
        );

        // Enviamos el resultado (un array de objetos con Clave, Descripcion, etc.)
        res.status(200).json(rows);

    } catch (err) {
        // En caso de error, lo reportamos sin tumbar el servidor
        console.error("Error en GET /getproductosporlineaeinv:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener productos del inventario", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getproductoscontadosporauditoreinv", async (req, res) => {
    // Respetamos tus nombres de variables y parámetros de query
    const InventarioID = req.query.InventarioID;
    const auditor = req.query.Auditor;

    console.log("Dentro getproductoscontadosporauditoreinv ", InventarioID, "-", auditor);

    // Validación preventiva
    if (!InventarioID || !auditor) {
        return res.status(400).json({ 
            error: "Faltan parámetros requeridos: InventarioID y Auditor." 
        });
    }

    try {
        // Consultamos exactamente tu tabla 'ProductoContados' con sus campos originales
        const [rows] = await pool.query(
            'SELECT Clave, Descripcion, Unidad, Existencia, Observaciones FROM ProductoContados WHERE InventarioID=? and Auditor=?', 
            [InventarioID, auditor]
        );

        // Enviamos el resultado tal cual lo espera tu App
        res.status(200).json(rows);

    } catch (err) {
        console.error("Error en /getproductoscontadosporauditoreinv:", err);
        
        // Enviamos el error al cliente para evitar el cuelgue de la petición
        res.status(500).json({ 
            error: "Error interno en el servidor", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getproductoscontadosporauditorporlineaeinv", async (req, res) => {
    // Respetamos tus nombres de variables y parámetros de query exactos
    const InventarioID = req.query.InventarioID;
    const Linea = req.query.Linea;
    const auditor = req.query.Auditor;

    console.log("Dentro getproductoscontadosporauditorlineaeinv ", InventarioID, "-", Linea, "-", auditor);

    // Validación de parámetros
    if (!InventarioID || !Linea || !auditor) {
        return res.status(400).json({ 
            error: "Faltan parámetros: InventarioID, Linea y Auditor son obligatorios." 
        });
    }

    try {
        // Consultamos la tabla ProductoContados con los campos originales
        const [rows] = await pool.query(
            'SELECT Clave, Descripcion, Unidad, Existencia, Observaciones FROM ProductoContados WHERE InventarioID=? and Auditor=? and Linea=?', 
            [InventarioID, auditor, Linea]
        );

        // Enviamos el resultado tal cual lo espera tu aplicación
        res.status(200).json(rows);

    } catch (err) {
        console.error("Error en /getproductoscontadosporauditorporlineaeinv:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener productos contados por línea", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getdetallelinea", async (req, res) => {
    // Respetamos tus nombres de variables y parámetros de query exactos
    const InventarioID = req.query.InventarioID;
    const Linea = req.query.Linea;
    const auditor = req.query.auditor;

    // Validación preventiva para asegurar que la consulta no falle por falta de datos
    if (!InventarioID || !Linea || !auditor) {
        return res.status(400).json({ 
            error: "Faltan parámetros: InventarioID, Linea y auditor son obligatorios." 
        });
    }

    try {
        // Usamos exactamente tu consulta SQL, la vista 'inv_lineas_app_view' 
        // y los campos que tu App espera recibir.
        const [rows] = await pool.query(
            'SELECT InventarioID, Ciudad, Almacen, Linea, NombreLinea FROM inv_lineas_app_view WHERE InventarioID=? and Linea=? and Auditor=?', 
            [InventarioID, Linea, auditor]
        );

        // Enviamos el resultado (result) al cliente
        res.status(200).json(rows);

    } catch (err) {
        console.error("Error en GET /getdetallelinea:", err);
        
        // Evitamos que la petición se quede "colgada" en caso de error de base de datos
        res.status(500).json({ 
            error: "Error interno al obtener detalle de línea", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getclavesnoreg", async (req, res) => {
    console.log("Consultando claves no registradas pendientes...");

    try {
        // Ejecutamos la consulta directamente desde el pool.
        // La consulta original ya incluye el filtro de estatus y el ordenamiento.
        const [rows] = await pool.query(
            'SELECT clave, claveProveedor, nombre, sucursal, factura, fecha, estatus FROM clavesnoregistradasview WHERE estatus="Pendiente" ORDER BY fecha'
        );

        // Enviamos los resultados al cliente en formato JSON.
        res.status(200).json(rows);

    } catch (err) {
        // Registramos el error en la consola para depuración.
        console.error("Error en GET /getclavesnoreg:", err);

        // Notificamos al cliente que hubo un error, evitando que la App se quede esperando (timeout).
        res.status(500).json({ 
            error: "Error al obtener las claves no registradas", 
            details: err.message 
        });
    }
});

    //Actualizada
    app.get("/getclavesPuntuales", async (req, res) => {
    // Extraemos los datos de la query
    const { productos, rfc } = req.query;

    // Validación: verificamos que productos sea un arreglo y rfc exista
    if (!productos || !Array.isArray(productos) || !rfc) {
        return res.status(400).json({ 
            error: "Se requiere un arreglo de 'productos' y un 'rfc' válido." 
        });
    }

    console.log(`Buscando claves puntuales para RFC: ${rfc}`);
    const resultadosFinales = [];

    try {
        // Usamos un bucle for...of para que el await detenga la ejecución 
        // correctamente en cada iteración
        for (const item of productos) {
            // item.producto asumiendo la estructura que enviaba tu frontend
            const nombreProducto = item.producto;

            const [rows] = await pool.query(
                'SELECT clave FROM clavesProveeedorView WHERE claveprovedor=? AND rfc=?', 
                [nombreProducto, rfc]
            );

            // Si encontró la clave, la agregamos al arreglo de resultados
            if (rows.length > 0) {
                resultadosFinales.push({
                    productoOriginal: nombreProducto,
                    claveEncontrada: rows[0].clave
                });
            } else {
                resultadosFinales.push({
                    productoOriginal: nombreProducto,
                    claveEncontrada: null // Opcional: para saber qué no se encontró
                });
            }
        }

        // Enviamos la respuesta solo cuando el bucle ha terminado por completo
        res.status(200).json(resultadosFinales);

    } catch (err) {
        console.error("Error en /getclavesPuntuales:", err);
        res.status(500).json({ 
            error: "Error al procesar la búsqueda de claves", 
            details: err.message 
        });
    }
});

//Actualizada
app.post("/insertarMargenes", async (req, res) => {
    console.log("Iniciando proceso de actualización de márgenes...");

    // Obtenemos una conexión específica del pool para asegurar que el TRUNCATE 
    // y los INSERTS ocurran en la misma sesión si fuera necesario.
    const connection = await pool.getConnection();

    try {
        // 1. Limpiar la tabla antes de insertar
        // Usamos await para asegurar que la tabla esté vacía antes de seguir
        await connection.query('TRUNCATE TABLE margenes');
        console.log("Tabla margenes limpiada correctamente.");

        // 2. Insertar los nuevos datos uno por uno
        // Usamos for...of para que el await funcione y no saturemos el pool
        if (Array.isArray(req.body)) {
            for (const element of req.body) {
                const { familia, margen, sucursal } = element;

                // Validación básica interna para evitar insertar datos nulos
                if (familia && sucursal) {
                    await connection.query(
                        'INSERT INTO margenes(familia, margen, sucursal) VALUES(?, ?, ?)',
                        [familia, margen, sucursal]
                    );
                }
            }
        }

        // 3. Responder al cliente solo cuando TODO haya terminado
        res.status(200).send("MÁRGENES ACTUALIZADOS CORRECTAMENTE");

    } catch (err) {
        console.error("Error crítico en /insertarMargenes:", err);
        res.status(500).json({ 
            error: "No se pudieron insertar los márgenes", 
            details: err.message 
        });
    } finally {
        // MUY IMPORTANTE: Liberar la conexión de vuelta al pool
        connection.release();
    }
});

//Actualizada
app.get("/getmargen", async (req, res) => {
    const { familia, sucursal } = req.query;

    // Validación de parámetros obligatorios
    if (!familia || !sucursal) {
        return res.status(400).json({ 
            error: "Faltan parámetros requeridos: 'familia' y 'sucursal' son obligatorios." 
        });
    }

    console.log(`Consultando margen para Familia: ${familia}, Sucursal: ${sucursal}`);

    try {
        // Ejecutamos la consulta usando el pool
        const [rows] = await pool.query(
            'SELECT margen FROM margenes WHERE familia=? AND sucursal=?', 
            [familia, sucursal]
        );

        // Enviamos el resultado (será un arreglo, incluso si está vacío)
        res.status(200).json(rows);

    } catch (err) {
        console.error("Error en GET /getmargen:", err);
        
        res.status(500).json({ 
            error: "Error interno al obtener el margen", 
            details: err.message 
        });
    }
});

//actualizada
app.get("/getfamilias", async (req, res) => {
    console.log("Consultando familias disponibles...");

    try {
        // Ejecutamos la consulta directamente desde el pool
        // Usamos destructuring [result] porque mysql2/promise devuelve un array [filas, campos]
        const [result] = await pool.query('SELECT DISTINCT familia FROM margenes ORDER BY familia');

        // Enviamos el resultado al cliente
        res.status(200).json(result);

    } catch (err) {
        // Si la base de datos falla, atrapamos el error aquí
        console.error("Error al obtener familias:", err);

        // Es vital responder algo al cliente para que la petición no expire (timeout)
        res.status(500).send({
            error: "No se pudieron obtener las familias",
            details: err.message
        });
    }
    /* console.log("Inside getfamilias");
        db.query('SELECT DISTINCT familia FROM margenes order by familia',
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    res.send(result);
                }
            }
        ); */
})

//Actualizada
app.get("/margenes", async (req, res) => {
    //console.log("Obteniendo todos los márgenes...");

    try {
        // Ejecutamos la consulta usando el pool con promesas
        // [rows] extrae directamente el arreglo de resultados
        const [rows] = await pool.query('SELECT * FROM margenes');

        // Enviamos los datos al cliente con estatus 200 (OK)
        res.status(200).json(rows);

    } catch (err) {
        // Log detallado del error para tu depuración
        console.error("Error en GET /margenes:", err);

        // Notificamos al cliente que hubo un problema en el servidor
        res.status(500).json({
            error: "Error al consultar la tabla de márgenes",
            details: err.message
        });
    }
});

//Actualizada
app.get("/getSolSiembra", async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT cantidad, clave, observaciones, sucursal, fecha FROM faltantesview ORDER BY fecha'
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error("Error en GET /getSolSiembra:", err);
        res.status(500).json({ error: "Error al obtener solicitudes de siembra", details: err.message });
    }
});

//Actualiza
app.get("/getpreciosall", async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT clave, precio, precioIVA, sucursal FROM preciosView ORDER BY clave'
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error("Error en GET /getpreciosall:", err);
        res.status(500).json({ error: "Error al obtener todos los precios", details: err.message });
    }
});

//Actualiza
app.get("/getprecios", async (req, res) => {
    const { sucursal } = req.query;

    // Validación básica: si no hay sucursal, avisamos al cliente de inmediato
    if (!sucursal) {
        return res.status(400).json({ error: "El parámetro 'sucursal' es requerido" });
    }

    try {
        const [rows] = await pool.query(
            'SELECT clave, precio, precioIVA FROM preciosView WHERE sucursal=? ORDER BY clave',
            [sucursal]
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error(`Error en GET /getprecios para sucursal ${sucursal}:`, err);
        res.status(500).json({ error: "Error al obtener precios por sucursal", details: err.message });
    }
});

app.listen(3001, () => {
    console.log("Corriendo en el puerto 3001")
})
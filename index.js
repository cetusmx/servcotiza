const express = require("express");
const app = express();
const mysql = require("mysql");
const cors = require("cors");
//import { insertarLista } from "./database.js";
var bodyParser = require('body-parser');

app.use(cors());
/* app.use(express.json()); */
/* app.use(bodyParser.json({ limit: '20mb' })); */
app.use(express.json({
    type: ['application/json', 'text/plain'],
    limit: '50mb',
    extended: true
}))

const db = mysql.createConnection({
    host: "sealmarket.mx",
    user: "sealmark_cotizauser",
    password: "Trof#4102",
    database: "sealmark_cotizador"
});

/* const pool = mysql.createPool({
    host: "sealmarket.mx",
    user: "sealmark_cotizauser",
    password: "Trof#4102",
    database: "sealmark_cotizador"
}).promise(); */

app.post("/insertClaveManualNoRegistrada", (req, res) => {

    console.log(req.body)
    const clave = req.body.clave;
    const sucursal = req.body.sucursal;
    const rfc = req.body.proveedor;
    const factura = req.body.factura;
    const claveProveedor = req.body.claveProveedor;
    const fecha = req.body.fecha;
    const estatus = "Pendiente";
    const dummy = "";

    //console.log(clave + "-" + sucursal + "-" + rfc + "-" +factura+"-"+claveProveedor+"-"+fecha+"-"+estatus)

    db.query('INSERT INTO clavesnoregistradas(clave,sucursal,rfc,factura,claveProveedor,estatus,fecha) values(?,?,?,?,?,?,?)',
        [clave, sucursal, rfc, factura, claveProveedor, estatus, fecha],
        (err, result) => {
            if (err) {
                console.log(err)
                return res.send(err)
            }
        }
    );
    return res.send("INSERTED");
});

app.put("/actualiza", (req, res) => {

    console.log(req.body)

    const familia = req.body.fa;
    const margenDgo = req.body.du;
    const margenFllo = req.body.fr;
    const margenMaz = req.body.ma;
    const margenZac = req.body.za;
    const margenTecmin = req.body.te;
    const margenMayorista = req.body.my;
    const cambiaron = req.body.cambios;
    const sucDgo = "Durango";
    const sucFllo = "Fresnillo";
    const sucMzt = "Mazatlán";
    const sucZac = "Zacatecas";
    const sucTec = "Tecmin";
    const sucMay = "Mayorista";

    var resultado = [];

    if (cambiaron.includes(sucDgo)) {
        db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?', [margenDgo, sucDgo, familia],
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    resultado.push(result);
                    //res.send(result);
                }
            }
        );
    }
    if (cambiaron.includes(sucFllo)) {
        db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?', [margenFllo, sucFllo, familia],
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    resultado.push(result);
                    //res.send(result);
                }
            }
        );
    }
    if (cambiaron.includes(sucMzt)) {
        db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?', [margenMaz, sucMzt, familia],
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    resultado.push(result);
                    //res.send(result);
                }
            }
        );
    }
    if (cambiaron.includes(sucZac)) {
        db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?', [margenZac, sucZac, familia],
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    resultado.push(result);
                    //res.send(result);
                }
            }
        );
    }
    if (cambiaron.includes(sucTec)) {
        db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?', [margenTecmin, sucTec, familia],
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    resultado.push(result);
                    //res.send(result);
                }
            }
        );
    }
    if (cambiaron.includes(sucMay)) {
        db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?', [margenMayorista, sucMay, familia],
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    resultado.push(result);
                    //res.send(result);
                }
            }
        );
    }
    console.log(resultado);
    res.send(resultado);
})

/* app.post("/updateListaPrecios", (req, res) => {
    const data = req.body;
    console.log('Received data:', data);
    res.status(200).json({ message: 'Data received successfully.' });
}); */

app.post("/updateListaPrecios", (req, res) => {
    console.log(req.body);

    req.body.map(element => {
        console.log(element);

        const clave = element.Clave;
        const precio = element.Precio;
        const sucursal = element.Sucursal;

        console.log(clave + "-" + precio + "-" + sucursal);
        db.query('UPDATE precios SET precio=? WHERE clave=? AND sucursal=?', [precio, clave, sucursal],
            //db.query('INSERT INTO precios(clave,precio,sucursal) values(?,?,?)', [clave,precio,sucursal],
            (err, result) => {
                if (err) {
                    return res.send(err)
                    console.log(err)
                }
            }
        );
    });
    return res.send("INSERTED");
})

app.post("/updateMargenes", (req, res) => {
    console.log(req.body);

    req.body.map(element => {
        console.log(element);

        const margen = element.margen;
        const familia = element.familia;
        const sucursal = element.sucursal;

        console.log(margen + "-" + familia + "-" + sucursal);
        db.query('UPDATE margenes SET margen=? WHERE familia=? AND sucursal=?', [margen, familia, sucursal],
            (err, result) => {
                if (err) {
                    return res.send(err)
                    console.log(err)
                }
            }
        );

    });

    return res.send("INSERTED");
})

app.post("/borrarLista", (req, res) => {

    const sucursal = req.query.sucursal;

    db.query('DELETE FROM precios WHERE sucursal=?', [sucursal],
        (err, result) => {
            if (err) {
                return res.send(err)
                console.log(err)
            }
        }
    );
    return res.send("BORRADA");
})

app.get("/borrarMargenes", (req, res) => {

    const sucursal = req.query.sucursal;

    db.query('TRUNCATE TABLE margenes',
        (err, result) => {
            if (err) {
                return res.send(err)
                console.log(err)
            }
        }
    );
})

app.post("/insertarSiembra", (req, res) => {
    console.log(req.body);

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

    console.log(clave + "-" + familia + "-" + motivo + "-" + veces + "-" + sucursal + "-" + observaciones + "-" + maximo);

    db.query('INSERT INTO siembraProds(fecha,clave,familia,motivo,veces,observaciones,sucursal,maximo,estatus,autorizacion) values(?,?,?,?,?,?,?,?,?,?)',
        [fecha, clave, familia, motivo, veces, observaciones, sucursal, maximo, estatus, autorizacion],
        (err, result) => {
            if (err) {
                return res.send(err)
                console.log(err)
            }
        }
    );
    return res.send("INSERTED");
})

app.post("/insertarLista", async (req, res) => {

    /* const valuesArray = [];
    for (let i = 0; i < req.body.length; i++) {
        let currValue = Object.values(req.body[i]);
        valuesArray.push(currValue);
    }
    console.log(valuesArray)

    let sql = "INSERT INTO precios (clave, precio, sucursal) VALUES ?" */

    //const [result] = await pool.query(sql, [valuesArray])
    //const written = result.affectedRows

    //const rows = await insertarLista(req.body)
    //res.status(200).send(written)
    /*  return res.send("INSERTED");
 }) */

    /* const sucu = req.query.sucursal;

    db.query('DELETE FROM precios WHERE sucursal=?', [sucu],
        (err, result) => {
            if (err) {
                return res.send(err)
                console.log(err)
            }
        }
    ); */
    //console.log(req.body)

    /* const valuesArray = [];
    //const keysArray = [];
    for (let i = 0; i < req.body.length; i++) {
        //let currKey = Object.keys(arrOfObj[i]);
        let currValue = Object.values(req.body[i]);
        //keysArray.push(currKey);
        valuesArray.push(currValue);
    }  */

    await req.body.map(element => {

        const clave = element.clave;
        const precio = element.precio;
        const sucursal = element.sucursal;

        console.log(clave + "-" + precio + "-" + sucursal);

        db.query('INSERT INTO precios(clave,precio,sucursal) values(?,?,?)', [clave, precio, sucursal],
            (err, result) => {
                if (err) {
                    return res.send(err)
                    console.log(err)
                }
            }
        );

    });

    return res.send("INSERTED");
})

app.get("/getclaves", (req, res) => {
    const rfc = req.query.rfc;
    console.log(rfc);
    db.query('SELECT clave, claveprove FROM claveProveeedorView WHERE rfc=?', [rfc],
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
                //console.log(result);
            }
        }
    );
})

app.get("/getresumeninventarios", (req, res) => {
    
    db.query('SELECT InventarioID, qtyProductos, Ciudad, Almacen, Fecha, qtyLineas, ProgressPorcentage FROM inv_resumen_inventarios_app_view',
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
                console.log(result);
            }
        }
    );
})

app.get("/getresumeninventario", (req, res) => {
    const InventarioID = req.query.InventarioID;
    console.log(InventarioID);
    db.query('SELECT InventarioID, qtyProductos, Ciudad, Almacen, Fecha, qtyLineas, ProgressPorcentage FROM inv_resumen_inventarios_app_view WHERE InventarioID=?',[InventarioID],
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
                console.log(result);
            }
        }
    );
})

app.get("/getlineasinvresumen", (req, res) => {
    const InventarioID = req.query.id;
    db.query('SELECT DISTINCT Linea, IFNULL(SUBSTRING(Descripcion,1,20),"Nombre línea") AS NombreLinea, count(Clave) AS qtyProductos FROM Inventarios WHERE InventarioID=? GROUP BY Linea, LineaDesc', [InventarioID],
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
                res.send(err)
                console.log(err)
            } else {
                res.send(result);
                console.log(result);
            }
        }
    );
    //return res.send("Completado");
})
app.get("/getclavesnoreg", (req, res) => {
    //const rfc = req.query.rfc;
    db.query('SELECT clave, claveProveedor, nombre, sucursal, factura, fecha FROM clavesnoregistradasview ORDER BY fecha',
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
                res.send(err)
                console.log(err)
            } else {
                res.send(result);
                console.log(result);
            }
        }
    );
    //return res.send("Completado");
})

app.get("/getclavesPuntuales", (req, res) => {

    let cantidad;
    let producto;
    let clave = "";

    const productos = req.query.productos;
    const rfc = req.query.rfc;

    for (i = 0; i < req.query.productos.length; i++) {
        db.query('SELECT clave FROM clavesProveeedorView WHERE claveprovedor=? AND rfc=?', [req.query.productos[i].producto, rfc],
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    console.log(req.query.productos[i].producto);
                }
            }
        );
    };

    console.log(req.query.productos);
    //console.log(listaCompleta);

    res.send(req.query);
})

app.post("/insertarMargenes", (req, res) => {

    const sucursal = req.query.sucursal;

    db.query('TRUNCATE TABLE margenes',
        (err, result) => {
            if (err) {
                return res.send(err)
                console.log(err)
            }
        }
    );

    console.log(req.body);

    req.body.map(element => {
        console.log(element);

        const familia = element.familia;
        const margen = element.margen;
        const sucursal = element.sucursal;



        db.query('INSERT INTO margenes(familia,margen,sucursal) values(?,?,?)', [familia, margen, sucursal],
            (err, result) => {
                if (err) {
                    return res.send(err)
                    console.log(err)
                }
            }
        );

    });
    console.log("Insertado correctamente");
    return res.send("INSERTED");
})

app.get("/getmargen", (req, res) => {
    console.log(req.query)
    const familia = req.query.familia;
    const sucursal = req.query.sucursal;
    db.query('SELECT margen FROM margenes WHERE familia=? AND sucursal=?', [familia, sucursal],
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
                //console.log(result);
            }
        }
    );
})

app.get("/getfamilias", (req, res) => {

    db.query('SELECT DISTINCT familia FROM margenes order by familia',
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
            }
        }
    );
})

app.get("/margenes", (req, res) => {

    db.query('SELECT * FROM margenes',
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
            }
        }
    );
})

app.get("/getSolSiembra", (req, res) => {

    db.query('SELECT cantidad, clave, observaciones, sucursal, fecha FROM faltantesview ORDER BY fecha',
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
            }
        }
    );
})

app.get("/getpreciosall", (req, res) => {

    db.query('SELECT clave, precio, precioIVA, sucursal FROM preciosView ORDER BY clave',
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
            }
        }
    );
})

app.get("/getprecios", (req, res) => {
    const sucursal = req.query.sucursal;
    db.query('SELECT clave, precio, precioIVA FROM preciosView WHERE sucursal=? ORDER BY clave', [sucursal],
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
                //console.log(result);
            }
        }
    );
})

app.listen(3001, () => {
    console.log("Corriendo en el puerto 3001")
})
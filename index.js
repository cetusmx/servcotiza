const express = require("express");
const app = express();
const mysql = require("mysql");
const cors = require("cors");
var bodyParser = require('body-parser');

app.use(cors());
/* app.use(express.json()); */
app.use(bodyParser.json({ limit: '20mb' }));

const db = mysql.createConnection({
    host: "sealmarket.mx",
    user: "sealmark_cotizauser",
    password: "Trof#4102",
    database: "sealmark_cotizador"
});


app.put("/actualiza", (req, res) => {

    const familia = req.body.fa;
    const margenDgo = req.body.du;
    const margenFllo = req.body.fr;
    const margenMaz = req.body.ma;
    const margenZac = req.body.za;
    const margenTecmin = req.body.te;
    const cambiaron = req.body.cambios;
    const sucDgo = "Durango";
    const sucFllo = "Fresnillo";
    const sucMzt = "Mazatlán";
    const sucZac = "Zacatecas";
    const sucTec = "Tecmin";

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
                if(err)
                {
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
                if(err)
                {
                    return res.send(err)
                    console.log(err)
                }
            }
        );
        
    });

    return res.send("INSERTED");
})

app.get("/borrarLista", (req, res) => {
    
    const sucursal = req.query.sucursal;

    db.query('DELETE FROM precios WHERE sucursal=?', [sucursal],
        (err, result) => {
            if(err)
            {
                return res.send(err)
                console.log(err)
            }
        }
    );
})

app.get("/borrarMargenes", (req, res) => {
    
    const sucursal = req.query.sucursal;

    db.query('TRUNCATE TABLE margenes',
        (err, result) => {
            if(err)
            {
                return res.send(err)
                console.log(err)
            }
        }
    );
})

app.post("/insertarLista", (req, res) => {
    console.log(req.body);

    req.body.map(element => {
        console.log(element);

        const clave = element.Clave;
        const precio = element.Precio;
        const sucursal = element.Sucursal;

        console.log(clave + "-" + precio + "-" + sucursal);

        db.query('INSERT INTO precios(clave,precio,sucursal) values(?,?,?)', [clave,precio,sucursal],
            (err, result) => {
                if(err)
                {
                    return res.send(err)
                    console.log(err)
                }
            }
        );
        
    });

    return res.send("INSERTED");
})
app.post("/insertarSiembra", (req, res) => {
    console.log(req.body);

    /* req.body.map(element => { */
        /* console.log(element); */
        const fecha = req.body.fecha;
        const clave = req.body.clave;
        const familia = req.body.familia;
        const motivo = req.body.motivo;
        const veces = req.body.veces;
        const sucursal = req.body.sucursal;
        const observaciones = req.body.observaciones;
        const maximo = req.body.maximo;
        const estatus = "Abierta";
        const autorizacion = "Pendiente";

        console.log(clave + "-" + familia + "-" + motivo + "-" + veces + "-" + sucursal + "-" + observaciones + "-" + maximo);

        db.query('INSERT INTO siembraProds(fecha,clave,familia,motivo,veces,observaciones,sucursal,maximo,estatus,autorizacion) values(?,?,?,?,?,?,?,?,?,?)',
             [fecha,clave,familia,motivo,veces,observaciones,sucursal,maximo,estatus,autorizacion],
            (err, result) => {
                if(err)
                {
                    return res.send(err)
                    console.log(err)
                }
            }
        );
        
    /* } );*/

    return res.send("INSERTED");
})

app.post("/insertarLista", (req, res) => {
    console.log(req.body);

    req.body.map(element => {
        console.log(element);

        const clave = element.Clave;
        const precio = element.Precio;
        const sucursal = element.Sucursal;

        console.log(clave + "-" + precio + "-" + sucursal);

        db.query('INSERT INTO precios(clave,precio,sucursal) values(?,?,?)', [clave,precio,sucursal],
            (err, result) => {
                if(err)
                {
                    return res.send(err)
                    console.log(err)
                }
            }
        );
        
    });

    return res.send("INSERTED");
})

app.get("/getclaves", (req, res) => {

    console.log("Inside getclaves");
    //console.log(req.query);
    const productos = req.query.productos;
    const rfc = req.query.rfc;
    //console.log(productos);
    console.log(rfc);

    productos.map(element => {
        console.log(element.cantidad);
        console.log(element.producto);

        db.query('SELECT clave FROM clavesProveeedorView WHERE claveprovedor=? AND rfc=?', [element.producto, rfc],
            (err, result) => {
                if (err) {
                    console.groupCollapsed(err);
                } else {
                    //res.send(result);
                    console.log(result.data[0].margen);
                }
            }
        );

    })
    
    /* db.query('SELECT * FROM margenes',
        (err, result) => {
            if (err) {
                console.groupCollapsed(err);
            } else {
                res.send(result);
            }
        }
    ); */
})

app.post("/insertarMargenes", (req, res) => {
    console.log(req.body);

    req.body.map(element => {
        console.log(element);

        const familia = element.familia;
        const margen = element.margen;
        const sucursal = element.sucursal;

        console.log(familia + "-" + margen + "-" + sucursal);

        db.query('INSERT INTO margenes(familia,margen,sucursal) values(?,?,?)', [familia,margen,sucursal],
            (err, result) => {
                if(err)
                {
                    return res.send(err)
                    console.log(err)
                }
            }
        );
        
    });

    return res.send("INSERTED");
})

app.get("/getmargen", (req, res) => {
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

    db.query('SELECT * FROM siembraProds',
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

    db.query('SELECT clave, precio, sucursal FROM precios',
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
    db.query('SELECT clave, precio, precioIVA FROM preciosView WHERE sucursal=?', [sucursal],
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
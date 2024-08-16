const express = require("express");
const app = express();
const mysql = require("mysql");
const cors = require("cors");

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host:"sealmarket.mx",
    user: "sealmark_cotizauser",
    password: "Trof#4102",
    database: "sealmark_cotizador"
});


app.put("/actualiza",(req,res)=>{
    /* console.log(req.method);
    console.log(req.body);
    console.log(req.body.fa);
    console.log(req.body.du);
    res.send();
 */
    const familia = req.body.fa;
    const margenDgo = req.body.du;
    const margenFllo = req.body.fr;
    const margenMaz = req.body.ma;
    const margenZac = req.body.za;
    const margenTecmin = req.body.te;
    const sucDgo="Durango";
    const sucFllo="Fresnillo";
    const sucMzt="Mazatlán";
    const sucZac="Zacatecas";
    const sucTec="Tecmin";

    db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?' ,[margenDgo,sucDgo,familia],
        (err,result)=>{
            if(err){
                console.groupCollapsed(err);
            }else{
                //res.send(result);
            }
        }
    );
    db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?',[margenFllo,sucFllo,familia],
        (err,result)=>{
            if(err){
                console.groupCollapsed(err);
            }else{
                //res.send(result);
            }
        }
    );
    db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?',[margenMaz,sucMzt,familia],
        (err,result)=>{
            if(err){
                console.groupCollapsed(err);
            }else{
                //res.send(result);
            }
        }
    );
    db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?',[margenZac,sucZac,familia],
        (err,result)=>{
            if(err){
                console.groupCollapsed(err);
            }else{
                //res.send(result);
            }
        }
    );
    db.query('UPDATE margenes SET margen=? WHERE sucursal=? AND familia=?',[margenTecmin,sucTec,familia],
        (err,result)=>{
            if(err){
                console.groupCollapsed(err);
            }else{
                res.send(result);
            }
        }
    );





})



app.get("/getmargen",(req,res)=>{
    const familia = req.query.familia;
    const sucursal = req.query.sucursal;
    db.query('SELECT margen FROM margenes WHERE familia=? AND sucursal=?',[familia,sucursal],
        (err,result)=>{
            if(err){
                console.groupCollapsed(err);
            }else{
                res.send(result);
                //console.log(result);
            }
        }
    );
})

app.get("/getfamilias",(req,res)=>{
    
    db.query('SELECT DISTINCT familia FROM margenes order by familia',
        (err,result)=>{
            if(err){
                console.groupCollapsed(err);
            }else{
                res.send(result);
            }
        }
    );
})

app.get("/margenes",(req,res)=>{
    
    db.query('SELECT * FROM margenes',
        (err,result)=>{
            if(err){
                console.groupCollapsed(err);
            }else{
                res.send(result);
            }
        }
    );
})

app.listen(3001,()=>{
    console.log("Corriendo en el puerto 3001")
})
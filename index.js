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
    console.log(req.method);
    console.log(req.query.fa)
    console.log(req.params)
    console.log(req.params.fa)
    console.log(req.params.du)
    res.send();
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
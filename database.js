import mysql from "mysql2";

/* import dotenv from "dotenv";
dotenv.config(); */

const pool = mysql.createPool({
    host: "sealmarket.mx",
    user: "sealmark_cotizauser",
    password: "Trof#4102",
    database: "sealmark_cotizador"
}).promise()

export async function getNotes(){
    const [rows] = await pool.query("SELECT * FROM precios")    //igual que const rows = result[0]
    return rows
}

export async function insertarLista(data) {

    const fecha = new Date().toJSON().slice(0, 10);
    console.log(data)
    const valuesArray = [];
    for (let i = 0; i < data.length; i++) {
        let currValue = Object.values(data[i]);
        valuesArray.push(currValue);
    }
   
    let sql = "INSERT INTO precios (clave, precio, sucursal) VALUES ?"

    const [result] = await pool.query(sql,[valuesArray])
    const written = result.affectedRows
    return written
}

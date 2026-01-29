const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sql = require("mssql");
const { getConnection } = require("../config/db"); 

const router = express.Router();

/* REGISTRO */
router.post("/register", async (req, res) => {
  try {
    const { nombre, correo, password, codigoSoporte } = req.body;

    if (!nombre || !correo || !password) return res.status(400).json({ error: "Datos incompletos" });
    if (password.length < 8) return res.status(400).json({ error: "Mínimo 8 caracteres" });

    const pool = await getConnection(); // Usamos la conexión segura

    // Verificar si existe
    const existe = await pool.request()
      .input("correo", sql.VarChar(100), correo)
      .query("SELECT IdUsuario FROM Usuarios WHERE CorUs = @correo");

    if (existe.recordset.length > 0) return res.status(409).json({ error: "Correo ya registrado" });

    // Definir rol 
    let rol = "USUARIO";
    if (codigoSoporte === process.env.SOPORTE_CODE) rol = "SOPORTE";

    const hash = await bcrypt.hash(password, 10);

    await pool.request()
      .input("nombre", sql.VarChar(100), nombre)
      .input("correo", sql.VarChar(100), correo)
      .input("password", sql.VarChar(255), hash)
      .input("rol", sql.VarChar(20), rol)
      .query("INSERT INTO Usuarios (NomUs, CorUs, PassHash, Rol) VALUES (@nombre, @correo, @password, @rol)");

    res.status(201).json({ success: true, message: "Usuario registrado" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en servidor" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const { correo, password } = req.body;
    const pool = await getConnection();

    const result = await pool.request()
      .input("correo", sql.VarChar(100), correo)
      .query("SELECT * FROM Usuarios WHERE CorUs = @correo");

    if (result.recordset.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

    const usuario = result.recordset[0];
    const valido = await bcrypt.compare(password, usuario.PassHash);

    if (!valido) return res.status(401).json({ error: "Credenciales inválidas" });

    const token = jwt.sign(
      { id: usuario.IdUsuario, rol: usuario.Rol, correo: usuario.CorUs },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "8h" }
    );

   
    res.json({
      success: true,
      token,
      user: { 
        nombre: usuario.NomUs,
        rol: usuario.Rol, 
        correo: usuario.CorUs
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error de servidor" });
  }
});

module.exports = router;
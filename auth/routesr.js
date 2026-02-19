const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sql = require("mssql");
const { getConnection } = require("../config/db");
require("dotenv").config();

const router = express.Router();

// REGISTRO
router.post("/register", async (req, res) => {
  try {
    const { nombre, correo, password, codigoSoporte } = req.body;

    if (!nombre || !correo || !password)
      return res.status(400).json({ error: "Datos incompletos" });
    if (password.length < 8)
      return res.status(400).json({ error: "Mínimo 8 caracteres" });

    const pool = await getConnection();

    // Verificar si existe
    const existe = await pool
      .request()
      .input("correo", sql.VarChar(100), correo)
      .query("SELECT IdUsuario FROM Usuarios WHERE CorUs = @correo");

    if (existe.recordset.length > 0)
      return res.status(409).json({ error: "Correo ya registrado" });

    // Definir rol
    let rol = "USUARIO";

    // Si escribió código, debe ser correcto para registrarse como SOPORTE
    if (codigoSoporte && codigoSoporte.trim().length > 0) {
      if (codigoSoporte.trim() !== process.env.SOPORTE_CODE.trim()) {
        return res.status(400).json({ error: "Código de soporte incorrecto" });
      }
      rol = "SOPORTE";
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool
      .request()
      .input("nombre", sql.VarChar(100), nombre)
      .input("correo", sql.VarChar(100), correo)
      .input("password", sql.VarChar(255), hash)
      .input("rol", sql.VarChar(20), rol).query(`
        INSERT INTO Usuarios (NomUs, CorUs, PassHash, Rol)
        OUTPUT INSERTED.IdUsuario
        VALUES (@nombre, @correo, @password, @rol);
      `);

    const nuevoId = result.recordset[0].IdUsuario;

    const token = jwt.sign(
      { id: nuevoId, rol: rol.trim(), correo: correo },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    return res.status(201).json({
      success: true,
      message: "Usuario registrado e identificado",
      token: token,
      user: {
        nombre: nombre,
        rol: rol,
        correo: correo,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error en servidor" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const { correo, password, codigoSoporte } = req.body;
    const pool = await getConnection();

    const result = await pool
      .request()
      .input("correo", sql.VarChar(100), correo)
      .query("SELECT * FROM Usuarios WHERE CorUs = @correo");

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const usuario = result.recordset[0];

    const valido = await bcrypt.compare(password, usuario.PassHash);
    if (!valido) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const rolLimpio = usuario.Rol
      ? usuario.Rol.trim().toUpperCase()
      : "USUARIO";
    const codigoIngresado = (codigoSoporte || "").trim();
    const codigoReal = (process.env.SOPORTE_CODE || "").trim();

    // ✅ REGLA: si es SOPORTE, el código es obligatorio y debe ser correcto
    if (rolLimpio === "SOPORTE") {
      if (!codigoIngresado) {
        return res
          .status(400)
          .json({ error: "Debe ingresar el código de soporte" });
      }
      if (codigoIngresado !== codigoReal) {
        return res.status(400).json({ error: "Código de soporte incorrecto" });
      }
    } else {
      // Recomendado: si NO es soporte, no debe usar código
      if (codigoIngresado) {
        return res.status(400).json({ error: "Código inválido" });
      }
    }

    const token = jwt.sign(
      { id: usuario.IdUsuario, rol: rolLimpio, correo: usuario.CorUs },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "8h" },
    );

    return res.json({
      success: true,
      token,
      user: {
        nombre: usuario.NomUs,
        rol: rolLimpio,
        correo: usuario.CorUs,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

module.exports = router;

// privateRoutes.js (versión corregida para tu SQL nuevo)

const express = require("express");
const router = express.Router();
const sql = require("mssql");
const axios = require("axios");
const { getConnection } = require("../config/db");
const { auth, soloSoporte } = require("../auth/middleware");
const {
  enviarConfirmacionTicket,
  enviarNotificacionSoporte,
} = require("../utils/emailService");

// =====================
// HISTORIAL (NUEVO SQL)
// =====================
// Ruta final esperada (si montas con app.use("/api/admin", router)):
// GET /api/admin/tickets/historial
router.get("/tickets/historial", soloSoporte, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT TOP 200
        IdHistorial,
        IdTicket,
        Estado,
        IdUsuario,
        FecCreacion
      FROM dbo.TicketHistorial
      ORDER BY FecCreacion DESC
    `);

    return res.json({ success: true, historial: result.recordset || [] });
  } catch (error) {
    console.error("ERROR historial:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener historial",
      detalle: error.message,
    });
  }
});

// =====================
// OBTENER TICKETS
// =====================
// Ruta final esperada:
// GET /api/admin/tickets
router.get("/tickets", soloSoporte, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT
        t.IdTicket,
        t.IdDep,
        d.NomDep,
        t.NombreContacto,
        t.CorreoContacto,
        t.DescripcionProblema,
        t.Estado,
        CONVERT(varchar(33), t.FechaCreacion, 127) + 'Z' AS FechaCreacion
      FROM dbo.tickets t
      INNER JOIN dbo.departamentos d ON d.IdDep = t.IdDep
      ORDER BY t.FechaCreacion DESC
    `);

    return res.json({ success: true, tickets: result.recordset || [] });
  } catch (error) {
    console.error("ERROR GET /tickets:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener tickets",
      detalle: error.message,
    });
  }
});

// =====================
// ACTUALIZAR ESTADO + HISTORIAL (IdUsuario NOT NULL)
// =====================
// Ruta final esperada:
// PUT /api/admin/tickets/:id/estado
router.put("/tickets/:id/estado", auth, soloSoporte, async (req, res) => {
  const { id } = req.params;
  const { nuevoEstado } = req.body;

  if (!nuevoEstado) {
    return res.status(400).json({ error: "nuevoEstado es requerido" });
  }

  if (!req.usuario || !req.usuario.id) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }

  const idUsuario = Number(req.usuario.id);

  const pool = await getConnection();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // 1) Update estado
    await new sql.Request(tx)
      .input("id", sql.Int, Number(id))
      .input("estado", sql.VarChar(20), nuevoEstado).query(`
        UPDATE dbo.tickets
        SET Estado = @estado
        WHERE IdTicket = @id
      `);

    // 2) Insert historial
    await new sql.Request(tx)
      .input("idTicket", sql.Int, Number(id))
      .input("estado", sql.VarChar(20), nuevoEstado)
      .input("idUsuario", sql.Int, idUsuario).query(`
        INSERT INTO dbo.TicketHistorial (IdTicket, Estado, IdUsuario, FecCreacion)
        VALUES (@idTicket, @estado, @idUsuario, GETDATE())
      `);

    await tx.commit();

    return res.json({
      success: true,
      IdTicket: Number(id),
      Estado: nuevoEstado,
    });
  } catch (err) {
    try {
      await tx.rollback();
    } catch {}

    console.error("ERROR ACTUALIZAR ESTADO:", err);
    return res.status(500).json({
      success: false,
      error: "Error al actualizar estado",
      detalle: err.message,
    });
  }
});

// =====================
// CREAR TICKET (sin cambios funcionales)
// =====================
// Ruta final esperada:
// POST /api/admin/tickets
router.post("/tickets", async (req, res) => {
  try {
    const { idDep, nombreContacto, correoContacto, descripcionProblema } =
      req.body;

    const pool = await getConnection();
    const result = await pool
      .request()
      .input("idDep", sql.Int, idDep)
      .input("nombreContacto", sql.VarChar(100), nombreContacto)
      .input("correoContacto", sql.VarChar(100), correoContacto)
      .input("descripcionProblema", sql.VarChar(sql.MAX), descripcionProblema)
      .query(`
        INSERT INTO dbo.tickets
          (IdDep, NombreContacto, CorreoContacto, DescripcionProblema, Estado, FechaCreacion)
        OUTPUT INSERTED.IdTicket, INSERTED.FechaCreacion
        VALUES
          (@idDep, @nombreContacto, @correoContacto, @descripcionProblema, 'Abierto', SYSUTCDATETIME());
      `);

    const idTicket = result.recordset[0].IdTicket;
    const fechaCreacionDB = result.recordset[0].FechaCreacion;

    const deptResult = await pool
      .request()
      .input("idDep", sql.Int, idDep)
      .query("SELECT NomDep FROM dbo.departamentos WHERE IdDep = @idDep");

    const nombreDepartamento =
      deptResult.recordset.length > 0
        ? deptResult.recordset[0].NomDep
        : "Sin especificar";

    // Correos
    try {
      await enviarConfirmacionTicket(
        correoContacto,
        idTicket,
        nombreContacto,
        descripcionProblema,
        nombreDepartamento,
      );

      await enviarNotificacionSoporte(
        idTicket,
        nombreContacto,
        correoContacto,
        descripcionProblema,
        nombreDepartamento,
      );
    } catch (emailError) {
      console.warn("⚠️ Error al enviar correos:", emailError.message);
    }

    // N8N
    try {
      const n8nPayload = {
        idTicket,
        idDep,
        nombreDepartamento,
        nombreContacto,
        correoContacto,
        descripcionProblema,
        estado: "Abierto",
        fechaCreacion: fechaCreacionDB,
      };

      await axios.post("http://localhost:5678/webhook/tickets", n8nPayload, {
        timeout: 5000,
      });
    } catch (n8nError) {
      console.warn("⚠️ N8N no disponible:", n8nError.message);
    }

    return res.status(201).json({
      success: true,
      mensaje: "Ticket creado exitosamente",
      ticket: {
        idTicket,
        idDep,
        nombreDepartamento,
        nombreContacto,
        correoContacto,
        descripcionProblema,
        estado: "Abierto",
        fechaCreacion: fechaCreacionDB,
      },
    });
  } catch (error) {
    console.error("✗ Error al crear ticket:", error);
    return res.status(500).json({
      success: false,
      error: "Error al crear ticket",
      detalle: error.message,
    });
  }
});

module.exports = router;

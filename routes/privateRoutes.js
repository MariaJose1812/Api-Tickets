const express = require("express");
const router = express.Router();
const sql = require("mssql");
const axios = require("axios"); 
const { getConnection } = require("../config/db");
const { soloSoporte } = require("../auth/middleware");
const { enviarConfirmacionTicket, enviarNotificacionSoporte } = require("../utils/emailService");

// Crear Ticket
router.post("/tickets", async (req, res) => {
  try {
    const { idDep, nombreContacto, correoContacto, descripcionProblema } = req.body;
    const pool = await getConnection();
    const result = await pool.request()
      .input("idDep", sql.Int, idDep)
      .input("nombreContacto", sql.VarChar(100), nombreContacto)
      .input("correoContacto", sql.VarChar(100), correoContacto)
      .input("descripcionProblema", sql.VarChar(sql.MAX), descripcionProblema)
      .query(`
        INSERT INTO tickets (IdDep, NombreContacto, CorreoContacto, DescripcionProblema, Estado, FechaCreacion)
        VALUES (@idDep, @nombreContacto, @correoContacto, @descripcionProblema, 'Abierto', GETDATE());
        SELECT SCOPE_IDENTITY() as idTicket;
      `);

    const idTicket = result.recordset[0].idTicket;
    
    const deptResult = await pool
      .request()
      .input("idDep", sql.Int, idDep)
      .query("SELECT NomDep FROM departamentos WHERE IdDep = @idDep");

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
        nombreDepartamento
      );

      await enviarNotificacionSoporte(
        idTicket,
        nombreContacto,
        correoContacto,
        descripcionProblema,
        nombreDepartamento
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
        fechaCreacion: new Date().toISOString(),
      };

      await axios.post("http://localhost:5678/webhook/tickets", n8nPayload, {
        timeout: 5000,
      });
    } catch (n8nError) {
      console.warn("⚠️ N8N no disponible:", n8nError.message);
    }

    res.status(201).json({
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
        fechaCreacion: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("✗ Error al crear ticket:", error);
    res.status(500).json({
      error: "Error al crear ticket",
      detalle: error.message,
    });
  }
});

// Obtener todos los tickets
router.get("/tickets", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT * FROM tickets ORDER BY FechaCreacion DESC");
        res.json({ success: true, tickets: result.recordset });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener tickets" });
    }
});

// Actualizar Estado (Solo Soporte)
router.put("/api/tickets/:idTicket/estado", soloSoporte, async (req, res) => {
  try {
    const { idTicket } = req.params;
    const nuevoEstado = req.body.nuevoEstado || req.body.Estado;

    if (!nuevoEstado) {
      return res.status(400).json({ error: "Falta el nuevo estado" });
    }

    const estadosPermitidos = ["Abierto", "En Proceso", "Terminado"];
if (!estadosPermitidos.includes(nuevoEstado)) {
  return res.status(400).json({
    error: "Estado no válido",
    recibido: raw,
    recibidoNormalizado: nuevoEstado,
    permitidos: estadosPermitidos,
  });
}

    const result = await pool
      .request()
      .input("idTicket", sql.Int, idTicket)
      .input("nuevoEstado", sql.VarChar(50), nuevoEstado)
      .query(`
  UPDATE tickets
  SET Estado = LTRIM(RTRIM(@nuevoEstado))
  WHERE IdTicket = @idTicket
`);
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    res.json({
      success: true,
      mensaje: `Estado del ticket #${idTicket} actualizado a '${nuevoEstado}'`,
    });
  } catch (error) {
    console.error("X Error al actualizar estado del ticket:", error);
    res.status(500).json({ error: "Error al actualizar estado del ticket" });
  }
});

module.exports = router;
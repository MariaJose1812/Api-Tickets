const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { getConnection } = require("../config/db");

// Obtener Departamentos
router.get("/departamentos", async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .query("SELECT IdDep, NomDep FROM departamentos ORDER BY NomDep");

    res.json({
      success: true,
      total: result.recordset.length,
      departamentos: result.recordset,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener departamentos" });
  }
});

// Consultar un ticket específico por ID 
router.get("/tickets/:idTicket", async (req, res) => {
  try {
    const { idTicket } = req.params;
    const pool = await getConnection();
    const result = await pool
      .request()
      .input("idTicket", sql.Int, idTicket)
      .query(`
        SELECT t.IdTicket, t.IdDep, d.NomDep, 
               t.NombreContacto, t.CorreoContacto, t.DescripcionProblema, 
               t.Estado, t.FechaCreacion
        FROM tickets t
        INNER JOIN departamentos d ON t.IdDep = d.IdDep
        WHERE t.IdTicket = @idTicket
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }
    res.json({ success: true, ticket: result.recordset[0] });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener ticket" });
  }
});

module.exports = router;
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const sql = require("mssql");
require("dotenv").config();

const {
  enviarConfirmacionTicket,
  enviarNotificacionSoporte,
  verificarConexion,
} = require("./utils/emailService");

const { getConnection } = require("./config/db");
const authRoutes = require("./auth/routesr");
const { auth, soloSoporte } = require("./auth/middleware");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/api", auth);

let pool;

/* Departamentos */
app.get("/api/departamentos", async (req, res) => {
  try {
    const result = await pool
      .request()
      .query("SELECT IdDep, NomDep FROM departamentos ORDER BY NomDep");

    res.json({
      success: true,
      total: result.recordset.length,
      departamentos: result.recordset,
    });
  } catch (error) {
    console.error("X Error al obtener departamentos:", error);
    res.status(500).json({ error: "Error al obtener departamentos" });
  }
});

/* Crear Tickets */
app.post("/api/tickets", async (req, res) => {
  try {
    const { idDep, nombreContacto, correoContacto, descripcionProblema } =
      req.body;

    if (!idDep || !nombreContacto || !correoContacto || !descripcionProblema) {
      return res.status(400).json({
        error: "Datos incompletos",
        campos_requeridos: [
          "idDep",
          "nombreContacto",
          "correoContacto",
          "descripcionProblema",
        ],
      });
    }

    const request = pool.request();
    const result = await request
      .input("idDep", sql.Int, idDep)
      .input("nombreContacto", sql.VarChar(100), nombreContacto)
      .input("correoContacto", sql.VarChar(100), correoContacto)
      .input("descripcionProblema", sql.VarChar(sql.MAX), descripcionProblema)
      .query(`
        INSERT INTO tickets 
        (IdDep, NombreContacto, CorreoContacto, DescripcionProblema, Estado, FechaCreacion)
        VALUES 
        (@idDep, @nombreContacto, @correoContacto, @descripcionProblema, 'Abierto', GETDATE());
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

/* Get Todos los Tickets */
app.get("/api/tickets", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT t.IdTicket, t.IdDep, d.NomDep, 
             t.NombreContacto, t.CorreoContacto, t.DescripcionProblema, 
             t.Estado, t.FechaCreacion
      FROM tickets t
      INNER JOIN departamentos d ON t.IdDep = d.IdDep
      ORDER BY t.FechaCreacion DESC
    `);

    res.json({
      success: true,
      total: result.recordset.length,
      tickets: result.recordset,
    });
  } catch (error) {
    console.error("X Error al obtener tickets:", error);
    res.status(500).json({ error: "Error al obtener tickets" });
  }
});

/* Ticket por ID */
app.get("/api/tickets/:idTicket", async (req, res) => {
  try {
    const { idTicket } = req.params;

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

    res.json({
      success: true,
      ticket: result.recordset[0],
    });
  } catch (error) {
    console.error("X Error al obtener ticket:", error);
    res.status(500).json({ error: "Error al obtener ticket" });
  }
});

/* Actualiza estado */
app.put("/api/tickets/:idTicket/estado", soloSoporte, async (req, res) => {
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


const PORT = 3000;

app.listen(PORT, async () => {
  try {
    pool = await getConnection();
    console.log("✓ Conectado a SQL Server - BD: SistemaTickets");
    console.log("✓ API REST corriendo en http://localhost:" + PORT);

    // Verificación de correo 
    verificarConexion().catch((e) =>
      console.warn("⚠️ Verificación de correo falló:", e.message)
    );
  } catch (error) {
    console.error("X Error al conectar a SQL Server:", error);
    console.error(
      "Verifica que SQL Server SQLEXPRESS esté corriendo y la BD exista."
    );
  }
});

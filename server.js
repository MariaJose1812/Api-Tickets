const express = require("express");
const cors = require("cors");
const axios = require("axios");
const sql = require("mssql");
require("dotenv").config();
const { enviarConfirmacionTicket, enviarNotificacionSoporte, verificarConexion } = require("./utils/emailService");

const app = express();
app.use(cors());
app.use(express.json());

//  CONFIGURACIÓN BASE DE DATOS SQL SERVER 
const dbConfig = {
  server: process.env.SQL_SERVER || "localhost\\SQLEXPRESS",
  database: process.env.SQL_DATABASE || "SistemaTickets",
  authentication: {
    type: "default",
    options: {
      userName: process.env.SQL_USER || "n8n_user",
      password: process.env.SQL_PASSWORD || "N8nSegura123"
    }
  },
  options: {
    encrypt: false, 
    trustServerCertificate: true,
    enableKeepAlive: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    useUTC: true
  }
};

// Pool de conexión
let pool;

async function conectarBD() {
  try {
    pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();
    console.log("✓ Conectado a SQL Server (localhost\\SQLEXPRESS) - Base de datos: SistemaTickets");
  } catch (error) {
    console.error("X Error al conectar a SQL Server:", error);
    console.error("Verifica que SQL Server SQLEXPRESS esté corriendo y la BD SistemaTickets exista.");
  }
}

//  ENDPOINT POST: CREAR TICKET 
app.post("/api/tickets", async (req, res) => {
  try {
    const { idDep, nombreContacto, correoContacto, descripcionProblema } = req.body;

    // Validar datos
    if (!idDep || !nombreContacto || !correoContacto || !descripcionProblema) {
      return res.status(400).json({ 
        error: "Datos incompletos",
        campos_requeridos: ["idDep", "nombreContacto", "correoContacto", "descripcionProblema"]
      });
    }

    console.log("📥 Datos recibidos:", { idDep, nombreContacto, correoContacto, descripcionProblema });

    // Guardar en SQL Server
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
        SELECT @@IDENTITY as idTicket;
      `);

    const idTicket = result.recordset[0].idTicket;
    console.log(`✓ Ticket #${idTicket} guardado en BD`);

    // Obtener nombre del departamento
    const deptResult = await pool.request()
      .input("idDep", sql.Int, idDep)
      .query("SELECT NomDep FROM departamentos WHERE IdDep = @idDep");
    
    const nombroDepartamento = deptResult.recordset.length > 0 
      ? deptResult.recordset[0].NomDep 
      : "Sin especificar";

    // ✉️ ENVIAR CORREOS AL USUARIO Y SOPORTE
    try {
      // Enviar correo al usuario
      await enviarConfirmacionTicket(
        correoContacto,
        idTicket,
        nombreContacto,
        descripcionProblema,
        nombroDepartamento
      );

      // Enviar correo al equipo de soporte
      await enviarNotificacionSoporte(
        idTicket,
        nombreContacto,
        correoContacto,
        descripcionProblema,
        nombroDepartamento
      );
    } catch (emailError) {
      console.warn(`⚠️ Advertencia: Error al enviar correos:`, emailError.message);
      // Continuamos sin fallar, ya que el ticket se guardó correctamente
    }

    // Enviar a N8N
    try {
      const n8nPayload = {
        idTicket,
        idDep,
        nombreDepartamento: nombroDepartamento,
        nombreContacto,
        correoContacto,
        descripcionProblema,
        estado: "Abierto",
        fechaCreacion: new Date().toISOString()
      };

      console.log("Enviando a N8N:", n8nPayload);
      
      await axios.post(
        "http://localhost:5678/webhook/tickets",
        n8nPayload,
        { timeout: 5000 }
      );
      console.log(`✓ Ticket #${idTicket} enviado a N8N`);
    } catch (n8nError) {
      console.warn(`N8N no disponible o timeout, pero ticket guardado en BD:`, n8nError.message);
    }

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      mensaje: "Ticket creado exitosamente",
      ticket: {
        idTicket,
        idDep,
        nombreDepartamento: nombroDepartamento,
        nombreContacto,
        correoContacto,
        descripcionProblema,
        estado: "Abierto",
        fechaCreacion: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("✗ Error al crear ticket:", error);
    res.status(500).json({ 
      error: "Error al crear ticket",
      detalle: error.message
    });
  }
});

// ENDPOINT GET: OBTENER TODOS LOS TICKETS 
app.get("/api/tickets", async (req, res) => {
  try {
    const result = await pool.request()
      .query(`
        SELECT t.IdTicket, t.IdDep, d.NomDep, 
               t.NombreContacto, t.CorreoContacto, t.DescripcionProblema, t.Estado, t.FechaCreacion
        FROM tickets t
        INNER JOIN departamentos d ON t.IdDep = d.IdDep
        ORDER BY t.FechaCreacion DESC
      `);
    
    res.json({
      success: true,
      total: result.recordset.length,
      tickets: result.recordset
    });
  } catch (error) {
    console.error("X Error al obtener tickets:", error);
    res.status(500).json({ error: "Error al obtener tickets" });
  }
});

// ENDPOINT GET: OBTENER TICKET ESPECÍFICO 
app.get("/api/tickets/:numeroTicket", async (req, res) => {
  try {
    const { numeroTicket } = req.params;
    
    const result = await pool.request()
      .input("numeroTicket", sql.Int, numeroTicket)
      .query(`
        SELECT t.IdTicket, t.IdDep, d.NomDep, 
               t.NombreContacto, t.CorreoContacto, t.DescripcionProblema, t.Estado, t.FechaCreacion
        FROM tickets t
        INNER JOIN departamentos d ON t.IdDep = d.IdDep
        WHERE t.NumeroTicket = @numeroTicket
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    res.json({
      success: true,
      ticket: result.recordset[0]
    });
  } catch (error) {
    console.error("X Error al obtener ticket:", error);
    res.status(500).json({ error: "Error al obtener ticket" });
  }
});

// ENDPOINT GET: OBTENER DEPARTAMENTOS 
app.get("/api/departamentos", async (req, res) => {
  try {
    const result = await pool.request()
      .query("SELECT IdDep, NomDep FROM departamentos ORDER BY NomDep");
    
    res.json({
      success: true,
      total: result.recordset.length,
      departamentos: result.recordset
    });
  } catch (error) {
    console.error("X Error al obtener departamentos:", error);
    res.status(500).json({ error: "Error al obtener departamentos" });
  }
});

// INICIAR SERVIDOR 
const PORT = 3000;
conectarBD().then(async () => {
  // Verificar configuración de correo
  await verificarConexion();
  
  app.listen(PORT, () => {
    console.log(`✓ API REST corriendo en http://localhost:${PORT}`);
    console.log(`✓ Endpoint POST: http://localhost:${PORT}/api/tickets`);
    console.log(`✓ Endpoint GET: http://localhost:${PORT}/api/tickets`);
  });
});
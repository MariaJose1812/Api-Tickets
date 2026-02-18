const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./auth/routesr");
const publicRoutes = require("./routes/publicRoutes");
const privateRoutes = require("./routes/privateRoutes");
const { auth } = require("./auth/middleware");

const app = express();
app.use(cors());
app.use(express.json());


let pool;
exports.pool = pool;


// 1. Rutas de Autenticación
app.use("/auth", authRoutes);

// 2. Rutas Públicas 
app.use("/api/public", publicRoutes);

// 3. Rutas Privadas 
app.use("/api/admin", auth, privateRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✓ Servidor en puerto ${PORT}`);
});

process.on('uncaughtException', (err) => console.error('Se evitó un cierre del servidor (Exception):', err));
process.on('unhandledRejection', (reason) => console.error('Promesa no manejada (Rejection):', reason));

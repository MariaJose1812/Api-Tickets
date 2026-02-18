const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = {
      id: decoded.id,
      rol: decoded.rol,
      correo: decoded.correo,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

function soloSoporte(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }

  if (req.usuario.rol !== "SOPORTE" && req.usuario.rol !== "ADMIN") {
    return res.status(403).json({ error: "Acceso solo para soporte" });
  }

  next();
}

module.exports = { auth, soloSoporte };

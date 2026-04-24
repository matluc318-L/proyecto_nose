const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS visitas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_visita TEXT UNIQUE NOT NULL,
      dni TEXT NOT NULL,
      celular TEXT NOT NULL,
      nombres TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      motivo TEXT NOT NULL,
      tipo_persona_visitar TEXT NOT NULL,
      nombre_persona_visitar TEXT NOT NULL,
      grado TEXT NOT NULL,
      seccion TEXT NOT NULL,
      fecha_hora_entrada TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function generarCodigoVisita() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random4 = String(Math.floor(1000 + Math.random() * 9000));
  return `V-${yyyy}${mm}${dd}-${random4}`;
}

function validarPayload(payload) {
  const requiredFields = [
    "dni",
    "celular",
    "nombres",
    "apellidos",
    "motivo",
    "tipo_persona_visitar",
    "nombre_persona_visitar",
    "grado",
    "seccion"
  ];

  for (const field of requiredFields) {
    if (!payload[field] || String(payload[field]).trim() === "") {
      return `El campo "${field}" es obligatorio.`;
    }
  }

  if (!/^\d{8}$/.test(payload.dni)) {
    return "El DNI debe tener exactamente 8 digitos numericos.";
  }

  if (!/^\d{9,15}$/.test(payload.celular)) {
    return "El celular debe tener entre 9 y 15 digitos numericos.";
  }

  return null;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/visitas", (req, res) => {
  const payload = {
    dni: String(req.body.dni || "").trim(),
    celular: String(req.body.celular || "").trim(),
    nombres: String(req.body.nombres || "").trim(),
    apellidos: String(req.body.apellidos || "").trim(),
    motivo: String(req.body.motivo || "").trim(),
    tipo_persona_visitar: String(req.body.tipo_persona_visitar || "").trim(),
    nombre_persona_visitar: String(req.body.nombre_persona_visitar || "").trim(),
    grado: String(req.body.grado || "").trim(),
    seccion: String(req.body.seccion || "").trim()
  };

  const validationError = validarPayload(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const fechaHoraEntrada = new Date().toISOString();
  const codigoVisita = generarCodigoVisita();

  const sql = `
    INSERT INTO visitas (
      codigo_visita, dni, celular, nombres, apellidos, motivo,
      tipo_persona_visitar, nombre_persona_visitar, grado, seccion, fecha_hora_entrada
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    codigoVisita,
    payload.dni,
    payload.celular,
    payload.nombres,
    payload.apellidos,
    payload.motivo,
    payload.tipo_persona_visitar,
    payload.nombre_persona_visitar,
    payload.grado,
    payload.seccion,
    fechaHoraEntrada
  ];

  db.run(sql, params, function onInsert(err) {
    if (err) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ error: "Conflicto al generar el codigo de visita. Intenta nuevamente." });
      }
      return res.status(500).json({ error: "No se pudo registrar la visita." });
    }

    return res.status(201).json({
      id: this.lastID,
      codigo_visita: codigoVisita,
      fecha_hora_entrada: fechaHoraEntrada,
      ...payload
    });
  });
});

app.get("/api/visitas/:codigo", (req, res) => {
  const { codigo } = req.params;
  db.get("SELECT * FROM visitas WHERE codigo_visita = ?", [codigo], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Error al consultar la visita." });
    }
    if (!row) {
      return res.status(404).json({ error: "No se encontro la visita." });
    }
    return res.json(row);
  });
});

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});

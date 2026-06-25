require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la base de datos Turso
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Inicialización de la base de datos Turso
async function initDb() {
  try {
    // Crear tabla empleados si no existe
    await db.execute(`
      CREATE TABLE IF NOT EXISTS empleados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
      )
    `);

    // Crear tabla asistencia si no existe
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asistencia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        comio INTEGER NOT NULL CHECK (comio IN (0, 1)),
        FOREIGN KEY(empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
        UNIQUE(empleado_id, fecha)
      )
    `);

    console.log('Conexión con Turso exitosa y base de datos lista.');
  } catch (error) {
    console.error('Error crítico al inicializar base de datos en Turso:', error);
    process.exit(1);
  }
}

// Inicializar base de datos al arrancar
initDb();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS DE LA API REST ---

// 1. Obtener todos los empleados
app.get('/api/empleados', async (req, res) => {
  try {
    const rs = await db.execute('SELECT id, nombre FROM empleados ORDER BY nombre ASC');
    res.json(rs.rows);
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 1b. Registrar un nuevo empleado
app.post('/api/empleados', async (req, res) => {
  const { nombre } = req.body;

  if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
    return res.status(400).json({ error: 'El nombre del empleado es obligatorio.' });
  }

  try {
    await db.execute({
      sql: 'INSERT INTO empleados (nombre) VALUES (?)',
      args: [nombre.trim()]
    });
    res.status(201).json({ success: true, message: 'Empleado agregado exitosamente.' });
  } catch (error) {
    console.error('Error al agregar empleado:', error);
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ya existe un empleado con este nombre.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// 2. Obtener asistencia de todos los empleados para una fecha específica (YYYY-MM-DD)
app.get('/api/asistencia', async (req, res) => {
  const { fecha } = req.query;
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Fecha inválida o ausente. Use el formato YYYY-MM-DD.' });
  }

  try {
    const rs = await db.execute({
      sql: `
        SELECT 
          e.id AS empleado_id, 
          e.nombre, 
          COALESCE(a.comio, 0) AS comio
        FROM empleados e
        LEFT JOIN asistencia a ON e.id = a.empleado_id AND a.fecha = ?
        ORDER BY e.nombre ASC
      `,
      args: [fecha]
    });
    
    // Convertir comio de 0/1 a boolean para el frontend
    const resultado = rs.rows.map(row => ({
      empleado_id: Number(row.empleado_id),
      nombre: row.nombre,
      comio: Number(row.comio) === 1
    }));
    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener asistencia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 3. Registrar o actualizar asistencia de un empleado
app.post('/api/asistencia', async (req, res) => {
  const { empleado_id, fecha, comio } = req.body;

  if (!empleado_id || typeof empleado_id !== 'number') {
    return res.status(400).json({ error: 'ID de empleado inválido.' });
  }
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Fecha inválida. Use el formato YYYY-MM-DD.' });
  }
  if (typeof comio !== 'boolean') {
    return res.status(400).json({ error: 'El campo comio debe ser un booleano.' });
  }

  const comioVal = comio ? 1 : 0;

  try {
    const rs = await db.execute({
      sql: `
        INSERT INTO asistencia (empleado_id, fecha, comio)
        VALUES (?, ?, ?)
        ON CONFLICT(empleado_id, fecha) 
        DO UPDATE SET comio = excluded.comio
      `,
      args: [empleado_id, fecha, comioVal]
    });
    res.json({ success: true, changes: Number(rs.rowsAffected) });
  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 4. Reporte: Total de comidas consumidas en un rango de fechas
app.get('/api/reporte', async (req, res) => {
  const { desde, hasta } = req.query;

  if (!desde || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !hasta || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return res.status(400).json({ error: 'Fechas del rango inválidas o ausentes. Use YYYY-MM-DD.' });
  }

  try {
    const rs = await db.execute({
      sql: `
        SELECT 
          e.id AS empleado_id, 
          e.nombre, 
          SUM(COALESCE(a.comio, 0)) AS total_comidas
        FROM empleados e
        LEFT JOIN asistencia a ON e.id = a.empleado_id AND a.fecha >= ? AND a.fecha <= ?
        GROUP BY e.id, e.nombre
        ORDER BY total_comidas DESC, e.nombre ASC
      `,
      args: [desde, hasta]
    });
    
    const resultado = rs.rows.map(row => ({
      empleado_id: Number(row.empleado_id),
      nombre: row.nombre,
      total_comidas: Number(row.total_comidas || 0)
    }));
    res.json(resultado);
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

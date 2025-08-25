// index.js
require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { json } = require("express/lib/response");
const PORT = process.env.PORT;

const iv = Buffer.from("qualityi", "ascii"); // 8 bytes
const key = Buffer.from("rpaSPvIvVLlrcmtzPU9/c67Gkj7yL1S5", "base64"); // 24 bytes

const app = express();
app.use(express.json());

// Ruta del archivo JSON que simula la tabla
const dataFile = path.join(__dirname, "clientes.json");
const logAccessFile = path.join(__dirname, "AccessLog.json");

// Función auxiliar: leer archivo
function leerClientes() {
  if (!fs.existsSync(dataFile)) return [];
  const data = fs.readFileSync(dataFile, "utf-8");
  return JSON.parse(data);
}

// Función auxiliar: guardar archivo
function guardarClientes(clientes) {
  fs.writeFileSync(dataFile, JSON.stringify(clientes, null, 2));
}

// Endpoint 1: obtener todos los clientes
app.get("/api/Usuarios", (req, res) => {
  const clientes = leerClientes();
  res.json(clientes);
});
app.get("/", (req, res) => {
  res.send("📡 Patacom API en funcionamiento - versión 25.08.21");
});
// Endpoint 2: agregar cliente si no existe
app.post("/api/Usuarios", (req, res) => {
  const { Usuario, FechaInicio, FechaFinal, MostrarAviso, Dias, ModoLectura, Mensaje } = req.body;

  if (!Usuario || !FechaInicio || !FechaFinal) {
    return res.status(400).json({ error: "Faltan campos obligatorios: Usuario, FechaInicio, FechaFinal" });
  }

  let clientes = leerClientes();

  // Verificar si ya existe el usuario
  const existe = clientes.find(c => c.Usuario === Usuario);
  if (existe) {
    return res.status(200).json({ message: "El usuario ya existe", cliente: existe });
  }

  // Generar nuevo ID
  const nuevoID = clientes.length > 0 ? Math.max(...clientes.map(c => c.ID)) + 1 : 1;

  const nuevoCliente = {
    ID: nuevoID,
    Usuario,
    FechaInicio,
    FechaFinal,
    MostrarAviso: MostrarAviso || null,
    Dias: Dias || null,
    ModoLectura: ModoLectura || null,
    Mensaje: Mensaje || null,
  };

  clientes.push(nuevoCliente);
  guardarClientes(clientes);

  res.status(201).json({ message: "Cliente insertado con éxito", cliente: nuevoCliente });
});
// Endpoint 3: buscar cliente por cuit
app.post("/api/Cliente/ExpireLicense", (req, res) => {
  const { Usuario, Modelo} = req.body;
  const clientes = leerClientes();
  const codigoUsuario = desencriptar(Usuario);
  const cliente = clientes.find(c => c.Usuario === codigoUsuario);
  if (!cliente) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  cliente.FechaFinal = soloFechaActualFormateada()
  guardarClientes(clientes);
  res.json(cliente);
});
app.post("/api/Cliente/ChangeLicense", (req, res) => {
  const { Usuario, Modelo, Fecha} = req.body;
  const clientes = leerClientes();
  const codigoUsuario = desencriptar(Usuario);
  const cliente = clientes.find(c => c.Usuario === codigoUsuario);
  if (!cliente) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  cliente.FechaFinal = Fecha;
  guardarClientes(clientes);
  res.json(cliente);
});
app.post("/api/Cliente/RenewLicense", (req, res) => {
  const { Usuario, Modelo, Dias} = req.body;
  const clientes = leerClientes();
  const codigoUsuario = desencriptar(Usuario);
  const cliente = clientes.find(c => c.Usuario === codigoUsuario);
  if (!cliente) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  cliente.FechaFinal = moverFecha(cliente.FechaFinal, Dias)
  guardarClientes(clientes);
  res.json(cliente);
});
// Endpoint 3: buscar cliente por cuit
app.post("/api/Cliente/CheckLicense", (req, res) => {
  const { Usuario, Modelo} = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  
  const clientes = leerClientes();
  const codigoUsuario = desencriptar(Usuario);
  const encontrados = clientes.filter(c => c.Usuario === codigoUsuario);
  if (encontrados.length === 0) {
    registrarAcceso(ip,"CUIT no encontrado");
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  let aviso = 'True';
  if (encontrados[0].MostrarAviso === 'F'){
    aviso = 'False';
  }
  let bloqueo = 'True';
  if(encontrados[0].ModoLectura === 'F'){
    bloqueo = 'False'
  }
  const data = {
    FechaVencimiento : encriptar(encontrados[0].FechaFinal),
    FechaConsulta : encriptar(fechaActualFormateada()),//fecha de hoy encriptada
    MuestraAviso : encriptar(aviso),
    DiasAviso : encriptar(encontrados[0].Dias.toString()),
    ModoBloqueo : encriptar(bloqueo),
    Mensaje : encriptar(encontrados[0].Mensaje)
  };
  registrarAcceso(ip,"Validacion Exitosa");
  res.json(data);
});
app.post("/api/Cliente/SeeLicense", (req, res) => {
  const { Usuario, Modelo} = req.body;
  const clientes = leerClientes();
  const codigoUsuario = desencriptar(Usuario);
  const encontrados = clientes.filter(c => c.Usuario === codigoUsuario);
  if (encontrados.length === 0) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  let aviso = 'True';
  if (encontrados[0].MostrarAviso === 'F'){
    aviso = 'False';
  }
  let bloqueo = 'True';
  if(encontrados[0].ModoLectura === 'F'){
    bloqueo = 'False'
  }
  const data = {
    Licencia : encontrados[0].Usuario,
    FechaVencimiento : encontrados[0].FechaFinal,
    DiasAviso : encontrados[0].Dias
  };

  res.json(data);
});
app.get("/api/Cliente/Log", (req, res) => {
  // Verifica si el archivo existe
  if (!fs.existsSync(logAccessFile)) {
    return res.json([]); // Devuelve array vacío si no hay registros
  }

  try {
    const accesos = JSON.parse(fs.readFileSync(logAccessFile, "utf-8"));
    res.json(accesos);
  } catch (err) {
    console.error("Error leyendo accesos.json:", err);
    res.status(500).json({ error: "No se pudo leer el archivo de accesos" });
  }
});
// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Encriptar (equivalente a Encriptar en C#)
function encriptar(input) {
  try {
    const cipher = crypto.createCipheriv("des-ede3-cbc", key, iv);
    let encrypted = cipher.update(input, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  } catch (err) {
    console.error("Error en encriptar:", err);
    return "";
  }
}

// Desencriptar (equivalente a Desencriptar en C#)
function desencriptar(input) {
  try {
    const decipher = crypto.createDecipheriv("des-ede3-cbc", key, iv);
    let decrypted = decipher.update(input, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    // Igual que en C#, devuelve vacío si falla
    return "";
  }
}
function fechaActualFormateada() {
  const ahora = new Date();

  const dd = String(ahora.getDate()).padStart(2, "0");
  const MM = String(ahora.getMonth() + 1).padStart(2, "0"); // Mes comienza en 0
  const yyyy = ahora.getFullYear();

  const HH = String(ahora.getHours()).padStart(2, "0");
  const mm = String(ahora.getMinutes()).padStart(2, "0");
  const ss = String(ahora.getSeconds()).padStart(2, "0");

  return `${dd}/${MM}/${yyyy} ${HH}:${mm}:${ss}`;
}
function soloFechaActualFormateada() {
  const ahora = new Date();

  const dd = String(ahora.getDate()).padStart(2, "0");
  const MM = String(ahora.getMonth() + 1).padStart(2, "0"); // Mes comienza en 0
  const yyyy = ahora.getFullYear();

  const HH = String(ahora.getHours()).padStart(2, "0");
  const mm = String(ahora.getMinutes()).padStart(2, "0");
  const ss = String(ahora.getSeconds()).padStart(2, "0");

  return `${dd}/${MM}/${yyyy} 00:00:00`;
}
function moverFecha(fechaStr, dias) {
  const soloFecha = fechaStr.replace(/\s+/g, " ").trim().split(" ")[0];
  const [ddStr, MMStr, yyyyStr] = soloFecha.split("/");

  const dd = parseInt(ddStr, 10);
  const MM = parseInt(MMStr, 10);
  const yyyy = parseInt(yyyyStr, 10);

  if (!dd || !MM || !yyyy) throw new Error("Formato esperado: dd/MM/yyyy [HH:mm:ss]");

  // Crea fecha local y fija hora 23:59:59
  const d = new Date(yyyy, MM - 1, dd, 23, 59, 59, 0);

    if (!Number.isFinite(d.getTime())) throw new Error("Fecha inválida");

  // Mueve días (positivos o negativos)
  d.setDate(d.getDate() + Number(dias || 0));

  // Reafirma 23:59:59 por si hubo salto de horario
  d.setHours(23, 59, 59, 0);
  const ddOut = String(d.getDate()).padStart(2, "0");
  const MMOut = String(d.getMonth() + 1).padStart(2, "0");
  const yyyyOut = d.getFullYear();

  return `${ddOut}/${MMOut}/${yyyyOut} 23:59:59`;
}
function registrarAcceso(ip,estado) {
  let accesos = [];
  if (fs.existsSync(logAccessFile)) {
    accesos = JSON.parse(fs.readFileSync(logAccessFile, "utf-8"));
  }

  accesos.push({
    ip: ip,
    fecha: fechaActualFormateada(),
    estado: estado
  });

  fs.writeFileSync(logAccessFile, JSON.stringify(accesos, null, 2));
}


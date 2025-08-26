const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { json } = require("express/lib/response");

const iv = Buffer.from("qualityi", "ascii"); // 8 bytes
const key = Buffer.from("rpaSPvIvVLlrcmtzPU9/c67Gkj7yL1S5", "base64"); // 24 bytes

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
module.exports = {
    encriptar,
    desencriptar,
    fechaActualFormateada,
    soloFechaActualFormateada,
    moverFecha,
    registrarAcceso,
    leerClientes,
    guardarClientes
}
const path = require("path");
const crypto = require("crypto");
const { json } = require("express/lib/response");
const multer = require("multer");
const fs = require("fs");
require('dotenv').config();
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER;
const { obtenerRutaBasePorId } = require('./versionManager');
const { env } = require("process");

const LICENCIAS_VALIDAS = ['PYME', 'SHOP', 'MUNI'];

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
function registrarAcceso(ip, estado) {
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
//valido si la extension del archivo es .zip
function esZip(nombreArchivo) {
  return path.extname(nombreArchivo).toLowerCase() === '.zip';
}
function generarCarpetaUpload(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`Carpeta ${folderPath} creada`);
  }
}
function configurarMulter(formatosPermitidos = null) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const Usuario = req.body.Usuario || "default";
      let FOLDER = path.join(UPLOAD_FOLDER,obtenerNombreCliente(Usuario)) ;
      generarCarpetaUpload(FOLDER);
      cb(null, FOLDER);
    },
    filename: (req, file, cb) => {
      const fileName = req.body.Modelo || "default";
      if (fileName && fileName.trim() !== "") {
        const version = generarNombreVersion(fileName);
        return cb(null, version + path.extname(file.originalname));
      }

      cb(null, file.originalname);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (!formatosPermitidos || formatosPermitidos.length === 0) {
      return cb(null, true); // no filtra
    }

    const ext = path.extname(file.originalname).toLowerCase();

    if (!formatosPermitidos.map(f => f.toLowerCase()).includes(ext)) {
      const err = new Error(
        `Formato inválido. Permitidos: ${formatosPermitidos.join(', ')}`
      );
      err.statusCode = 400;
      return cb(err, false);
    }

    cb(null, true);
  };

  return multer({
    storage,
    fileFilter
  });
}
function listFiles(folderPath) {
  return fs.promises.readdir(folderPath);
}
//limpio el contenido de una carpeta a excepcion del archivo del parametro, esto es para evitar mas de un archivo en la carpeta de actualizacion del sistema
function limpiarCarpetaExcepto(carpeta, archivoAConservar) {
  const archivos = fs.readdirSync(carpeta);
  
  archivos.forEach(nombre => {
    if (nombre !== archivoAConservar) {
      const ruta = path.join(carpeta, nombre);
      fs.unlinkSync(ruta);
    }
  });
}
//genera nombres de version 
function generarNombreVersion(nombreProducto) {
  const ahora = new Date();

  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  const hora = String(ahora.getHours()).padStart(2, '0');
  const minutos = String(ahora.getMinutes()).padStart(2, '0');

  return `${nombreProducto}_V${año}${mes}${dia}${hora}${minutos}`;
}
//
function obtenerDescargaPyme() {
  let rutaPyme = obtenerRutaBasePorId("PYME")
  if (!fs.existsSync(rutaPyme)) {
    return null;
  }

  const archivos = fs
    .readdirSync(rutaPyme)
    .filter(f => fs.statSync(path.join(rutaPyme, f)).isFile());

  if (archivos.length === 0) {
    return null;
  }

  if (archivos.length > 1) {
    throw new Error('Hay más de un archivo en la carpeta de descargas');
  }

  return archivos[0];
}

function obtenerNombreCliente(Usuario) {
  const clientes = leerClientes();
  const encontrados = clientes.filter(c => c.Usuario === Usuario);
  if (encontrados.length === 0) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  let ruta  = encontrados[0].Nombre;

  if (ruta === "") {
    return encontrados[0].Usuario;
  }

  return encontrados[0].Nombre;
}

function validarTipoLicencia(nombreVersion) {
  if (!nombreVersion || typeof nombreVersion !== 'string') {
    throw new Error('Debe especificar una licencia válida');
  }

  const licenciaNormalizada = nombreVersion.trim().toUpperCase();

  if (!LICENCIAS_VALIDAS.includes(licenciaNormalizada)) {
    throw new Error(`Licencia inválida: ${nombreVersion}`);
  }

  return licenciaNormalizada;
}
function estaVencida(fechaStr) {
  // fechaStr = "dd/MM/yyyy HH:mm:ss"

  const [fecha, hora] = fechaStr.split(" ");
  const [dd, MM, yyyy] = fecha.split("/");
  const [HH, mm, ss] = hora.split(":");

  const fechaLicencia = new Date(
    Number(yyyy),
    Number(MM) - 1, // meses empiezan en 0
    Number(dd),
    Number(HH),
    Number(mm),
    Number(ss)
  );

  const ahora = new Date();

  return fechaLicencia < ahora;
}

module.exports = {
  encriptar,
  desencriptar,
  fechaActualFormateada,
  soloFechaActualFormateada,
  moverFecha,
  registrarAcceso,
  leerClientes,
  guardarClientes,
  generarCarpetaUpload,
  configurarMulter,
  listFiles,
  esZip,
  limpiarCarpetaExcepto,
  generarNombreVersion,
  obtenerDescargaPyme,
  validarTipoLicencia,
  estaVencida,
  obtenerNombreCliente
}
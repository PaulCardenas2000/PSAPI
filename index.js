const utils = require('./utils.js');
require('dotenv').config();
const express = require("express");
const fs = require("fs");
const { json } = require("express/lib/response");
const PORT = process.env.PORT;
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER;
const path = require("path");
const logAccessFile = path.join(__dirname, "AccessLog.json");
const http = require('http');
const htmlRoot = path.join(__dirname, 'html', 'index.html');
const { actualizarVersion, generarCliente, obtenerDescargaUsuario, obtenerPath } = require('./clientesManager.js');

const { version } = require('os');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'html')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// Endpoint 1: Te trae todos los datos de licencias para los usuarios
app.get("/api/Usuarios", (req, res) => {
  const clientes = utils.leerClientes();
  res.json(clientes);
});
// Endpoint 2: te registra una licencia
app.post("/api/Usuarios", (req, res) => {
  const { Usuario, FechaInicio, FechaFinal, MostrarAviso, Dias, ModoLectura, Mensaje, TipoLicencia, Nombre, Path, Version } = req.body;

  try {
    const nuevoCliente = generarCliente(Usuario, FechaInicio, FechaFinal, MostrarAviso, Dias, ModoLectura, Mensaje, TipoLicencia, Nombre, Path, Version)
    clientes.push(nuevoCliente);

    utils.guardarClientes(clientes);

    res.status(201).json({ message: "Cliente insertado con éxito", cliente: nuevoCliente });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

});
// Endpoint 3: Expira una licencia llevando a fecha de hoy la fecha de vencimiento
app.post("/api/Cliente/ExpireLicense", (req, res) => {
  const { Usuario, Modelo } = req.body;
  const clientes = utils.leerClientes();
  const codigoUsuario = utils.desencriptar(Usuario);
  console.log(clientes)
  const cliente = clientes.find(c => c.Usuario === codigoUsuario);
  if (!cliente) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  cliente.FechaFinal = utils.soloFechaActualFormateada()
  utils.guardarClientes(clientes);
  res.json(cliente);
});
// Endpoint 4: Cambia la fecha de licencia 
app.post("/api/Cliente/ChangeLicense", (req, res) => {
  const { Usuario, Modelo, Fecha } = req.body;
  const clientes = utils.leerClientes();
  const codigoUsuario = utils.desencriptar(Usuario);
  const cliente = clientes.find(c => c.Usuario === codigoUsuario);
  if (!cliente) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  cliente.FechaFinal = Fecha;
  utils.guardarClientes(clientes);
  res.json(cliente);
});
// Endpoint 5: renueva la licencia X cantidad de dias, corriendo en una cantidad de dias en el futuro
app.post("/api/Cliente/RenewLicense", (req, res) => {
  const { Usuario, Modelo, Dias } = req.body;
  const clientes = utils.leerClientes();
  const codigoUsuario = utils.desencriptar(Usuario);
  const cliente = clientes.find(c => c.Usuario === codigoUsuario);
  if (!cliente) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  cliente.FechaFinal = utils.moverFecha(cliente.FechaFinal, Dias)
  utils.guardarClientes(clientes);
  res.json(cliente);
});
// Endpoint 6: valida los datos de la licencia
app.post("/api/Cliente/CheckLicense", (req, res) => {
  const { Usuario, Modelo } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  const clientes = utils.leerClientes();
  const codigoUsuario = utils.desencriptar(Usuario);
  const encontrados = clientes.filter(c => c.Usuario === codigoUsuario);
  if (encontrados.length === 0) {
    utils.registrarAcceso(ip, "CUIT no encontrado");
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  let aviso = 'True';
  if (encontrados[0].MostrarAviso === 'F') {
    aviso = 'False';
  }
  let bloqueo = 'True';
  if (encontrados[0].ModoLectura === 'F') {
    bloqueo = 'False'
  }
  const data = {
    FechaVencimiento: utils.encriptar(encontrados[0].FechaFinal),
    FechaConsulta: utils.encriptar(utils.fechaActualFormateada()),//fecha de hoy encriptada
    MuestraAviso: utils.encriptar(aviso),
    DiasAviso: utils.encriptar(encontrados[0].Dias.toString()),
    ModoBloqueo: utils.encriptar(bloqueo),
    Mensaje: utils.encriptar(encontrados[0].Mensaje),
  };
  utils.registrarAcceso(ip, "Validacion Exitosa");
  res.json(data);
});
// Endpoint 7: muestra la fecha de vencimiento sin hashear para una licencia
app.post("/api/Cliente/SeeLicense", (req, res) => {
  const { Usuario, Modelo } = req.body;
  const clientes = utils.leerClientes();
  const codigoUsuario = utils.desencriptar(Usuario);
  const encontrados = clientes.filter(c => c.Usuario === codigoUsuario);
  if (encontrados.length === 0) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }
  let aviso = 'True';
  if (encontrados[0].MostrarAviso === 'F') {
    aviso = 'False';
  }
  let bloqueo = 'True';
  if (encontrados[0].ModoLectura === 'F') {
    bloqueo = 'False'
  }
  const data = {
    Licencia: encontrados[0].Usuario,
    FechaVencimiento: encontrados[0].FechaFinal,
    DiasAviso: encontrados[0].Dias
  };

  res.json(data);
});
// Endpoint 8: devuelve los logs de accesso a /api/Cliente/CheckLicence
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
// Endpoint 9: devuelve un valor ya encriptado
app.post("/api/Encriptado", (req, res) => {
  const { Value } = req.body;
  const data = {
    Original: Value,
    Encriptado: utils.encriptar(Value)
  };
  res.json(data);
});
// Endpoint 10: Muestra los ednpoints
app.get("/api/Help", (req, res) => {
  const rutas = [
    { method: "GET", path: "/", description: "Ruta raíz, información general de la API" },
    { method: "GET", path: "/api/Usuarios", description: "Endpoint 1: Te trae todos los datos de licencias para los usuarios" },
    { method: "POST", path: "/api/Usuarios", description: "Endpoint 2: te registra una licencia" },
    { method: "POST", path: "/api/Cliente/ExpireLicense", description: "Endpoint 3: Expira una licencia llevando a fecha de hoy la fecha de vencimiento", body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni"}' },
    { method: "POST", path: "/api/Cliente/ChangeLicense", description: "Endpoint 4: Cambia la fecha de licencia ", body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni", "Fecha": "01/07/2025 00:00:00"}' },
    { method: "POST", path: "/api/Cliente/RenewLicense", description: "Endpoint 5: renueva la licencia X cantidad de dias, corriendo en una cantidad de dias en el futuro", body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni", "Dias": 30}' },
    { method: "POST", path: "/api/Cliente/CheckLicense", description: "Endpoint 6: valida los datos de la licencia", body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni"}' },
    { method: "POST", path: "/api/Cliente/SeeLicense", description: "Endpoint 7: muestra la fecha de vencimiento sin hashear para una licencia", body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni"}' },
    { method: "GET", path: "/api/Cliente/Log", description: "Endpoint 8: devuelve los logs de accesso a /api/Cliente/CheckLicence" },
    { method: "POST", path: "/api/Encriptado", description: "Endpoint 9: devuelve un valor ya encriptado", body: '{"Value":"30716332388"}' },
  ];
  res.json({
    message: "Listado de endpoints disponibles",
    endpoints: rutas
  });
});
// Endpoint 11: Este endpoint se encarga de la carga de archivos en una carpeta interna del proyecto
app.post("/api/Upload", (req, res) => {
  const upload = utils.configurarMulter(UPLOAD_FOLDER, null).single("archivo");
  upload(req, res, (err) => {
    //const customName = req.body.nombreArchivo || req.file.originalname;
    //console.log(customName)
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo" });
    }
    res.json({
      mensaje: "Archivo subido con éxito",
      nombre: req.file.originalname,
      ruta: path.join(UPLOAD_FOLDER, req.file.originalname)
    });
  });
});
// Endpoint 12: Este endpoint descarga el archivo del proyecto
app.get("/api/Download/:filename", (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(UPLOAD_FOLDER, fileName);

  // Verificar si existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Archivo no encontrado" });
  }

  // Forzar descarga
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error("Error al enviar archivo:", err);
      res.status(500).json({ error: "Error al enviar archivo" });
    }
  });
});
// Endpoint 12: Devuelve los archivos dentro en la carpeta de descargas
app.get("/api/Files", async (req, res) => {
  try {
    const files = await utils.listFiles(UPLOAD_FOLDER);
    res.json({ archivos: files });
  } catch (err) {
    console.error("Error al leer la carpeta:", err);
    res.status(500).json({ error: "No se pudo listar los archivos" });
  }
});
// Endpoint 13: subir comprimido de la version del sistema
app.post("/api/Actualizar", (req, res) => {
  const upload = utils.configurarMulter(['.zip']).single("archivo");
  upload(req, res, (err) => {
    if (err && err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }

    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo" });
    }
    const Usuario = req.body.Usuario || "default";
    let FOLDER = path.join(UPLOAD_FOLDER, utils.obtenerNombreCliente(Usuario));

    //Limpieza de los archivos de mi carpeta
    utils.limpiarCarpetaExcepto(FOLDER, req.file.filename);
    let clientes = actualizarVersion(Usuario);
    utils.guardarClientes(clientes);

    res.json({
      mensaje: "Archivo subido con éxito",
      nombre: req.file.filename,
      ruta: path.join(FOLDER, req.file.filename)
    });
  });
});
// Endpoint 14: Descarga la ultima version del sistema
app.post("/api/Patacom/Descargar", (req, res) => {
  try {
    const { Usuario, Modelo } = req.body;

    const clientes = utils.leerClientes();
    const codigoUsuario = utils.desencriptar(Usuario);
    const encontrados = clientes.filter(c => c.Usuario === codigoUsuario);
    if (encontrados.length === 0) {
      return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
    }

    let finalLicencia = encontrados[0].FechaFinal;
    const vencida = utils.estaVencida(finalLicencia);
    if (vencida) {
      return res.status(404).json({
        error: "La licencia registrada esta vencida."
      });
    }

    const archivo = obtenerDescargaUsuario(codigoUsuario);
    const ruta = obtenerPath(codigoUsuario);

    if (!archivo) {
      return res.status(404).json({
        error: "No hay ningún archivo disponible para descargar"
      });
    }

    const rutaCompleta = path.join(ruta, archivo);
    // Seguridad básica
    if (!fs.existsSync(rutaCompleta)) {
      return res.status(404).json({
        error: "El archivo no existe"
      });
    }

    res.download(rutaCompleta, archivo);
  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
});
// Endpoint 15: buscar la ultima version disponible de pyme
app.post("/api/Version", (req, res) => {
  const { Usuario, Modelo } = req.body;
  const clientes = utils.leerClientes();
  const codigoUsuario = utils.desencriptar(Usuario);
  const encontrados = clientes.filter(c => c.Usuario === codigoUsuario);
  if (encontrados.length === 0) {
    return res.status(404).json({ message: "No se encontró cliente con ese CUIT" });
  }

  const data = {
    Version: encontrados[0].Version
  };
  res.json(data);
});


// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});



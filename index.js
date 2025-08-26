const utils = require('./utils.js');
require('dotenv').config();
const express = require("express");
const fs = require("fs");
const { json } = require("express/lib/response");
const PORT = process.env.PORT;
const path = require("path");
const logAccessFile = path.join(__dirname, "AccessLog.json");

const app = express();
app.use(express.json());


app.get("/", (req, res) => {
  res.send("📡 Patacom API en funcionamiento - versión 25.08.26");
});
// Endpoint 1: Te trae todos los datos de licencias para los usuarios
app.get("/api/Usuarios", (req, res) => {
  const clientes = utils.leerClientes();
  res.json(clientes);
});
// Endpoint 2: te registra una licencia
app.post("/api/Usuarios", (req, res) => {
  const { Usuario, FechaInicio, FechaFinal, MostrarAviso, Dias, ModoLectura, Mensaje } = req.body;

  if (!Usuario || !FechaInicio || !FechaFinal) {
    return res.status(400).json({ error: "Faltan campos obligatorios: Usuario, FechaInicio, FechaFinal" });
  }

  let clientes = utils.leerClientes();

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
  utils.guardarClientes(clientes);

  res.status(201).json({ message: "Cliente insertado con éxito", cliente: nuevoCliente });
});
// Endpoint 3: Expira una licencia llevando a fecha de hoy la fecha de vencimiento
app.post("/api/Cliente/ExpireLicense", (req, res) => {
  const { Usuario, Modelo} = req.body;
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
  const { Usuario, Modelo, Fecha} = req.body;
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
  const { Usuario, Modelo, Dias} = req.body;
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
  const { Usuario, Modelo} = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  
  const clientes = utils.leerClientes();
  const codigoUsuario = utils.desencriptar(Usuario);
  const encontrados = clientes.filter(c => c.Usuario === codigoUsuario);
  if (encontrados.length === 0) {
    utils.registrarAcceso(ip,"CUIT no encontrado");
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
    FechaVencimiento : utils.encriptar(encontrados[0].FechaFinal),
    FechaConsulta : utils.encriptar(utils.fechaActualFormateada()),//fecha de hoy encriptada
    MuestraAviso : utils.encriptar(aviso),
    DiasAviso : utils.encriptar(encontrados[0].Dias.toString()),
    ModoBloqueo : utils.encriptar(bloqueo),
    Mensaje : utils.encriptar(encontrados[0].Mensaje)
  };
  utils.registrarAcceso(ip,"Validacion Exitosa");
  res.json(data);
});
// Endpoint 7: muestra la fecha de vencimiento sin hashear para una licencia
app.post("/api/Cliente/SeeLicense", (req, res) => {
  const { Usuario, Modelo} = req.body;
  const clientes = utils.leerClientes();
  const codigoUsuario = utils.desencriptar(Usuario);
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
  const { Value} = req.body;
  const data = {
    Original : Value,
    Encriptado : utils.encriptar(Value)
  };
  res.json(data);
});
// Endpoint 10: Muestra los ednpoints
app.get("/api/Help", (req, res) => {
  const rutas = [
    { method: "GET", path: "/", description: "Ruta raíz, información general de la API" },
    { method: "GET", path: "/api/Usuarios", description: "Endpoint 1: Te trae todos los datos de licencias para los usuarios" },
    { method: "POST", path: "/api/Usuarios", description: "Endpoint 2: te registra una licencia" },
    { method: "POST", path: "/api/Cliente/ExpireLicense", description: "Endpoint 3: Expira una licencia llevando a fecha de hoy la fecha de vencimiento",body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni"}' },
    { method: "POST", path: "/api/Cliente/ChangeLicense", description: "Endpoint 4: Cambia la fecha de licencia ",body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni", "Fecha": "01/07/2025 00:00:00"}' },
    { method: "POST", path: "/api/Cliente/RenewLicense", description: "Endpoint 5: renueva la licencia X cantidad de dias, corriendo en una cantidad de dias en el futuro",body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni", "Dias": 30}' },
    { method: "POST", path: "/api/Cliente/CheckLicense", description: "Endpoint 6: valida los datos de la licencia",body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni"}' },
    { method: "POST", path: "/api/Cliente/SeeLicense", description: "Endpoint 7: muestra la fecha de vencimiento sin hashear para una licencia",body: '{"Usuario":"kjs7U0aLquHqUxxw7f8cxQlKCG64T17X", "Modelo":"Muni"}' },
    { method: "GET", path: "/api/Cliente/Log", description: "Endpoint 8: devuelve los logs de accesso a /api/Cliente/CheckLicence"},
    { method: "POST", path: "/api/Encriptado", description: "Endpoint 9: devuelve un valor ya encriptado",body: '{"Value":"30716332388"}' },
  ];
  res.json({
    message: "Listado de endpoints disponibles",
    endpoints: rutas
  });
});
// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});



const fs = require('fs');
const path = require('path');
const utils = require('./utils.js');
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER;

const CLIENTES_FILE = path.join(__dirname, 'clientes.json');

function actualizarVersion(Usuario) {
    if (!fs.existsSync(CLIENTES_FILE)) {
        throw new Error('El archivo de clientes no existe');
    }

    const clientes = utils.leerClientes();
    const encontrados = clientes.filter(c => c.Usuario === Usuario);
    if (encontrados.length === 0) {
        throw new Error("No se encontró cliente con ese CUIT");
    }

    const nuevaVersion = obtenerFechaActual();

    encontrados[0].Version = nuevaVersion;

    if (encontrados[0].Path === "") {
        encontrados[0].Path = obtenerPathDefault(Usuario);
    }

    return clientes;
}
function obtenerPath(Usuario) {
    if (!fs.existsSync(CLIENTES_FILE)) {
        throw new Error('El archivo de clientes no existe');
    }

    const clientes = utils.leerClientes();
    const encontrados = clientes.filter(c => c.Usuario === Usuario);
    if (encontrados.length === 0) {
        throw new Error("No se encontró cliente con ese CUIT");
    }

    const nuevaVersion = obtenerFechaActual();

    encontrados[0].Version = nuevaVersion;

    if (encontrados[0].Path === "") {
        encontrados[0].Path = obtenerPathDefault(Usuario);
    }

    return encontrados[0].Path;
}
function generarCliente(Usuario, FechaInicio, FechaFinal, MostrarAviso, Dias, ModoLectura, Mensaje, TipoLicencia, Nombre, Path, Version) {
    let clientes = utils.leerClientes();
    const existe = clientes.find(c => c.Usuario === Usuario);

    if (existe) {
        throw new Error("El usuario ya existe");
    }
    const nuevoID = clientes.length > 0 ? Math.max(...clientes.map(c => c.ID)) + 1 : 1;

    const nuevoCliente = {
        ID: nuevoID,
        Usuario,
        FechaInicio,
        FechaFinal,
        MostrarAviso: MostrarAviso || "F",
        Dias: Dias || null,
        ModoLectura: ModoLectura || null,
        Mensaje: Mensaje || null,
        TipoLicencia: TipoLicencia || null,
        Nombre: Nombre || null,
        path: Path || path.join(UPLOAD_FOLDER, nombre),
        version: Version || "2026-01-01-01-01",
    };
    return nuevoCliente;
}

//internos

function obtenerPathDefault(Usuario) {
    if (!fs.existsSync(CLIENTES_FILE)) {
        throw new Error('El archivo de clientes no existe');
    }

    const clientes = utils.leerClientes();
    const encontrados = clientes.filter(c => c.Usuario === Usuario);
    if (encontrados.length === 0) {
        throw new Error("No se encontró cliente con ese CUIT");
    }

    const nombre = encontrados[0].Nombre || Usuario
    return path.join(UPLOAD_FOLDER, nombre);
}
function obtenerFechaActual() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}-${hh}-${min}`;
}
function obtenerDescargaUsuario(usuario) {

    let direccion = obtenerPath(usuario);
    const archivos = fs
        .readdirSync(direccion)
        .filter(f => fs.statSync(path.join(direccion, f)).isFile());

    if (archivos.length === 0) {
        return null;
    }

    if (archivos.length > 1) {
        throw new Error('Hay más de un archivo en la carpeta de descargas');
    }

    return archivos[0];
}

module.exports = {
    actualizarVersion,
    obtenerPath,
    generarCliente,
    obtenerDescargaUsuario
};
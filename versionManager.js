const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, 'versiones.json');
const instancias = ['PYME', 'SHOP', 'MUNY'];

function obtenerFechaActual() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}-${hh}-${min}`;
}

function crearInstanciaDefault(id) {
    const version = obtenerFechaActual();

    return {
        id: id,
        ultimaVersion: version,
        rutaBase: id,
        nombreArchivo: `${id}_${version}`
    };
}

function inicializarVersiones() {

    if (fs.existsSync(VERSION_FILE)) {
        return;
    }

    const data = {};

    instancias.forEach(id => {
        data[id] = crearInstanciaDefault(id);
    });

    fs.writeFileSync(
        VERSION_FILE,
        JSON.stringify(data, null, 4),
        'utf8'
    );

    Object.values(data).forEach(instancia => {
        const rutaInstancia = path.join(__dirname, instancia.rutaBase);
        if (!fs.existsSync(rutaInstancia)) {
            fs.mkdirSync(rutaInstancia, { recursive: true });
        }
    });

}

function obtenerUltimaVersion(id) {
    if (!fs.existsSync(VERSION_FILE)) {
        throw new Error('El archivo de versiones no existe');
    }

    const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));

    if (!data[id]) {
        throw new Error(`La instancia ${id} no existe`);
    }

    return data[id].ultimaVersion;
}

function actualizarVersion(id,nombreArchivo) {
    if (!fs.existsSync(VERSION_FILE)) {
        throw new Error('El archivo de versiones no existe');
    }

    const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));

    if (!data[id]) {
        throw new Error(`La instancia ${id} no existe`);
    }

    const nuevaVersion = obtenerFechaActual();

    data[id].ultimaVersion = nuevaVersion;
    data[id].nombreArchivo = nombreArchivo;

    fs.writeFileSync(
        VERSION_FILE,
        JSON.stringify(data, null, 4),
        'utf8'
    );

    return data[id];
}

function obtenerRutaBasePorId(id) {

    if (!id || typeof id !== 'string') {
        throw new Error('Debe especificar un ID válido');
    }

    if (!fs.existsSync(VERSION_FILE)) {
        throw new Error('No existe el archivo versiones.json');
    }

    const versiones = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));

    const idNormalizado = id.trim().toUpperCase();

    const instancia = versiones[idNormalizado];

    if (!instancia) {
        throw new Error(`El ID ${id} no existe en versiones.json`);
    }

    return instancia.rutaBase;
}

module.exports = {
    inicializarVersiones,
    obtenerUltimaVersion,
    actualizarVersion,
    obtenerRutaBasePorId
};

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const { MongoClient } = require('mongodb');




const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const port = process.env.PORT;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use((req, res, next) => {
    const publicPaths = ['/login.html', '/login', '/api/'];
    if (!publicPaths.some(p => req.path.startsWith(p)) && req.path !== '/') {
        return res.redirect('/login.html');
    }
    next(); 
});

// Rutas para páginas
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/historial', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'historial.html'));
});

app.get('/reportes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reportes.html'));
});

app.get('/configuracion', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'configuracion.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
})
.then(() => {
    console.log('CONECTADO a la DB');
})
.catch((error) => {
    console.log('Error de conexión MongoDB:', error.message);
});

// ============================================
// MODELOS
// ============================================

// Modelo WaterLevel
const WaterLevelSchema = new mongoose.Schema({
    sensor: { 
        type: String, 
        required: true,
        default: 'Sin Datos - Default'
    },
    value: { 
        type: Number, 
        required: true,
        min: -1,
        max: 100
    },
    // Campos calculados automáticamente por middleware
    volumen: Number,
    estado: { 
        type: String, 
        enum: ['Normal', 'Advertencia', 'Crítico']
    },
    ubicacion: String,
    timestamp: { type: Date, default: Date.now }
});

// Función auxiliar para obtener ubicación
function obtenerUbicacionPorSensorID(sensorId) {
    const mapa = {
        'TANQ-SENS-001': 'Cisterna 1',
    };
    return mapa[sensorId] || `Sensor ${sensorId}`;
}

// Función para valores por defecto
function calcularValoresPorDefecto(doc, next) {
    doc.volumen = -1;
    doc.estado = doc.value <= 5 ? 'Crítico' : doc.value <= 15 ? 'Advertencia' : doc.value <=-1 ? 'Sin datos' : 'Normal' ;
    doc.ubicacion = 'Sin datos';
    next();
}

// MIDDLEWARE: Calcula automáticamente volumen, estado, ubicación
WaterLevelSchema.pre('save', async function(next) {
    try {
        // 1. BUSCAR CONFIGURACIÓN ACTUAL
        const Configuracion = mongoose.model('Configuracions');
        const config = await Configuracion.findOne().sort({ timestamp: -1 });
        configuracionActual = config.toObject();
        
        if (!config) {
            console.log('Sin configuración');
            return calcularValoresPorDefecto(this, next);
        }
        
        // 2. USAR CONFIGURACIÓN REAL
        const capacidad = config.cisternaCapacidad || 10000;
        const umbralAlerta = config.umbralAlerta || 15;
        const umbralCritico = config.umbralCritico || 5;
        const muestreo = config.frecuenciaMuestreo || 10000;
        intervaloMuestreo = muestreo;
        // 3. CALCULAR VOLUMEN (litros)
        this.volumen = Math.round((this.value / 100) * capacidad);
        
        // 4. DETERMINAR ESTADO
        if (this.value <= umbralCritico) {
            this.estado = 'Crítico';
        } else if (this.value <= umbralAlerta) {
            this.estado = 'Advertencia';
        } else {
            this.estado = 'Normal';
        }
        
        // 5. ASIGNAR UBICACIÓN
        if (config.sensorID === this.sensor) {
            this.ubicacion = config.cisternaUbicacion || 'Tanque Principal';
        } else {
            this.ubicacion = obtenerUbicacionPorSensorID(this.sensor);
        }
        
    
        console.log(`Calculado automáticamente:`);
        console.log(`${this.value}% → ${this.volumen}L (de ${capacidad}L)`);
        console.log(`Estado: ${this.estado} (A:${umbralAlerta}%, C:${umbralCritico}%)`);
        console.log(`${this.ubicacion}`);
        
        next();
        
    } catch (error) {
        console.error('Error en cálculo:', error);
        calcularValoresPorDefecto(this, next);
    }
});

const WaterLevel = mongoose.model('WaterLevel', WaterLevelSchema);


const Configuracion = mongoose.model('Configuracions', {
    cisternaNombre: { type: String, default: 'Sin Datos' },
    cisternaCapacidad: { type: Number, default: 1 },
    cisternaUbicacion: { type: String, default: 'Sin Datos' },
    cisternaMaterial: { type: String, default: 'Sin Datos' },
    sensorModelo: { type: String, default: 'Sin Datos' },
    sensorID: { type: String, default: 'Sin Datos' },
    sensorInstalacion: { type: Date, default: new Date('2024-10-15') },
    sensorPrecision: { type: String, default: '±2%' },
    frecuenciaMuestreo: { type: Number, default: 0 },
    umbralAlerta: { type: Number, default: 35 },
    umbralCritico: { type: Number, default: 5 },
    timestamp: { type: Date, default: Date.now }
});

// ============================================
// CONFIGURACIÓN Y SIMULACIÓN
// ============================================

let intervaloMuestreo = 10002;
let intervaloID = null;
let configuracionActual = {
    cisternaNombre: '...',
    cisternaCapacidad: '...',
    cisternaUbicacion: 'Edificio ...',
    cisternaMaterial: '...',
    sensorModelo: '...',
    sensorID: '...',
    sensorInstalacion: '...',
    sensorPrecision: '±...%',
    frecuenciaMuestreo: 60000,
    umbralAlerta: 15,
    umbralCritico: 5
};

async function cargarConfiguracionInicial() {
    try {
        if (mongoose.connection.readyState === 1) {
            const config = await Configuracion.findOne().sort({ timestamp: -1 });
            if (config && config.frecuenciaMuestreo) {
                intervaloMuestreo = config.frecuenciaMuestreo;
                configuracionActual = config.toObject();
                console.log(`frecuencia: ${config.frecuenciaMuestreo}`);
                console.log(`Frecuencia cargada desde DB: ${intervaloMuestreo}ms`);
            }
        }
    } catch (error) {
        console.log('⚠️ Error cargando configuración:', error.message);
    }
}


// ============================================
// APIs EXISTENTES
// ============================================

app.get('/api/level', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ level: -1 });
        }
        const lastReading = await WaterLevel.findOne().sort({ timestamp: -1 }).maxTimeMS(30000);
        res.json({ level: lastReading ? lastReading.value : Math.floor(Math.random() * 100) });
    } catch (error) {
        res.json({ level: Math.floor(Math.random() * 100) });
    }
});

app.get('/api/configuracion', async (req, res) => {
    try {
               
        if (mongoose.connection.readyState !== 1) {
            console.log('MongoDB sin conexión. Error.');
        }else{
            
            const config = await Configuracion.findOne().sort({ timestamp: -1 });
            
            if (!config) {
                console.log('Error. No hay configuraciones guardadas');
            }else{
                console.log('Configuración cargada');
                configuracionActual = config.toObject();
                res.json(config);
            }
        }
        
    } catch (error) {
        console.error('Error cargando configuración:', error.message);
    }
});

app.post('/api/configuracion', async (req, res) => {
    try {      
        if (mongoose.connection.readyState !== 1) {
            console.log("MongoDB sin conexión");
        } else{
            const nuevaConfiguracion = new Configuracion({
                ...req.body,
                timestamp: new Date(),
                sensorInstalacion: req.body.sensorInstalacion ? 
                    new Date(req.body.sensorInstalacion) : 
                    new Date()
            });

            const configGuardada = await nuevaConfiguracion.save();
            
            configuracionActual = configGuardada.toObject();
            
            console.log('Nueva configuración guardada');
            
            res.json({ 
                success: true, 
                message: 'Configuración guardada', 
                data: configGuardada
            });
        }
        
    } catch (error) {
        console.error('Error guardando configuración:', error);
        configuracionActual = { ...configuracionActual, ...req.body };
        res.json({ 
            success: true, 
            message: 'No se ha podido guardar la configuración', 
            data: configuracionActual 
        });
    }
});

app.post('/api/servidor/reiniciar', async (req, res) => {
    try {     
        if (intervaloID) {
            clearInterval(intervaloID);
            console.log('⏹️ Muestreo detenido');
        }
        
        await cargarConfiguracionInicial();
        
        res.json({ 
            success: true, 
            message: `Servidor reiniciado. Nueva frecuencia: ${intervaloMuestreo}ms` 
        });
        
    } catch (error) {
        console.error('Error reiniciando servidor:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al reiniciar el servidor' 
        });
    }
});

app.get('/api/configuracion/dashboard', (req, res) => {
    res.json({
        cisternaNombre: configuracionActual.cisternaNombre,
        cisternaCapacidad: configuracionActual.cisternaCapacidad,
        cisternaUbicacion: configuracionActual.cisternaUbicacion,
        cisternaMaterial: configuracionActual.cisternaMaterial,
        sensorModelo: configuracionActual.sensorModelo,
        sensorID: configuracionActual.sensorID,
        sensorInstalacion: configuracionActual.sensorInstalacion,
        sensorPrecision: configuracionActual.sensorPrecision,
        frecuenciaMuestreo: configuracionActual.frecuenciaMuestreo
    });
});

// ============================================
// APIs PARA HISTORIAL Y ESP32
// ============================================
app.get('/api/records', async (req, res) => {
    try {
               
        const { page = 1, limit = 10, fechaInicio, fechaFin, sensor, estado } = req.query;
        console.log('🔍 Parámetros recibidos:', { sensor, estado, fechaInicio, fechaFin });
        
        const filtro = {};
        
        
        if (sensor && sensor !== '') {
            filtro.sensor = sensor;
        }
        if (estado && estado !== '') {
            filtro.estado = estado;
        }
        
       if (fechaInicio || fechaFin) {
            filtro.timestamp = {};
            if (fechaInicio) {
                const inicio = new Date(fechaInicio);
                inicio.setHours(0, 0, 0, 0);
                filtro.timestamp.$gte = inicio;
            }
            
            if (fechaFin) {
                const fin = new Date(fechaFin);
                fin.setHours(23, 59, 59, 999);
                filtro.timestamp.$lte = fin;
            }
        }
        
        
        const pagina = parseInt(page);
        const limite = parseInt(limit);
        const saltar = (pagina - 1) * limite;
        
        const [registros, total] = await Promise.all([
            WaterLevel.find(filtro)
                .sort({ timestamp: -1 })
                .skip(saltar)
                .limit(limite),
            WaterLevel.countDocuments(filtro)
        ]);
    
        
        res.json({
            success: true,
            records: registros.map(r => ({
                id: r._id,
                fecha: r.timestamp,
                sensor: r.sensor,
                nivel: r.value,
                volumen: r.volumen,
                estado: r.estado,
                ubicacion: r.ubicacion,
            })),
            pagination: {
                page: pagina,
                limit: limite,
                total: total,
                totalPages: Math.ceil(total / limite)
            }
        });
        
    } catch (error) {
        console.error('Error en /api/records:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener historial',
            message: error.message 
        });
    }
});


// Información del sistema
app.get('/api/system/info', async (req, res) => {
    try {
        const info = {
            estado: 'Funcionando',
            timestamp: new Date().toISOString(),
            
            endpoints: {
                historial: 'GET /api/records',
                configuracion: 'GET /api/configuracion',
                nivelActual: 'GET /api/level',

            },
            
            baseDeDatos: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
            
            estadisticas: mongoose.connection.readyState === 1 ? {
                totalRegistros: await WaterLevel.countDocuments(),
                sensoresActivos: await WaterLevel.distinct('sensor'),
                ultimoRegistro: await WaterLevel.findOne().sort({ timestamp: -1 })
                    .select('sensor value timestamp')
            } : null
        };
        
        res.json(info);
        
    } catch (error) {
        res.json({
            modo: 'SIMULACIÓN',
            estado: 'Error',
            error: error.message
        });
    }
});
// ============================================
// RUTA DE EXPORTACIÓN - CORREGIDA
// ============================================

app.get('/api/records/export', async (req, res) => {
    try {
        const { 
            format = 'csv', 
            columns, 
            allData,
            sensor, 
            estado, 
            fechaInicio, 
            fechaFin,
            sortBy = 'timestamp',
            sortOrder = 'desc'
        } = req.query;
        
        // 1. Construir query (usando WaterLevel, no Record)
        let query = {};
        
        // Mapear nombres frontend a backend
        const columnMap = {
            'timestamp': 'timestamp',
            'sensor': 'sensor',
            'nivel': 'value',  
            'volumen': 'volumen',
            'estado': 'estado',
            'ubicacion': 'ubicacion'
        };
        
        
        if (allData !== 'true') {
            // Mapear filtros frontend a campos backend
            if (sensor) {
                query.sensor = sensor;
            }
            if (estado) {
                query.estado = estado;
            }
            if (fechaInicio || fechaFin) {
                query.timestamp = {};
                if (fechaInicio) {
                    const inicio = new Date(fechaInicio);
                    inicio.setHours(0, 0, 0, 0);
                    query.timestamp.$gte = inicio;
                }
                if (fechaFin) {
                    const fin = new Date(fechaFin);
                    fin.setHours(23, 59, 59, 999);
                    query.timestamp.$lte = fin;
                }
            }
        }
        
        
        // 2. Obtener datos (usar WaterLevel, no Record)
        let records = await WaterLevel.find(query)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
        
        // 3. Transformar datos al formato frontend
        let transformedRecords = records.map(record => {
            return {
                timestamp: record.timestamp,
                sensor: record.sensor,
                nivel: record.value,      // 'value' en BD -> 'nivel' en frontend
                volumen: record.volumen,
                estado: record.estado,
                ubicacion: record.ubicacion
            };
        });
        
        // 4. Filtrar columnas si se especificaron
        if (columns) {
            const columnasArray = columns.split(',');
            transformedRecords = transformedRecords.map(record => {
                const filtered = {};
                columnasArray.forEach(col => {
                    if (record[col] !== undefined) {
                        filtered[col] = record[col];
                    }
                });
                return filtered;
            });
        }
        
        // 5. Exportar según formato
        if (format === 'csv') {
            // Generar CSV
            if (transformedRecords.length === 0) {
                return res.status(400).json({ error: 'No hay datos para exportar' });
            }
            
            const headers = Object.keys(transformedRecords[0]);
            const csvRows = [
                headers.join(','),
                ...transformedRecords.map(row => 
                    headers.map(header => {
                        const val = row[header];
                        // Convertir fechas
                        if (header === 'timestamp' && val instanceof Date) {
                            return val.toISOString();
                        }
                        // Escapar comas y comillas
                        if (typeof val === 'string') {
                            if (val.includes(',') || val.includes('"')) {
                                return `"${val.replace(/"/g, '""')}"`;
                            }
                        }
                        return val !== undefined ? val : '';
                    }).join(',')
                )
            ];
            
            const csvContent = csvRows.join('\n');
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=export_${Date.now()}.csv`);
            res.send(csvContent);
            
        } else if (format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=export_${Date.now()}.json`);
            res.json(transformedRecords);
        } else {
            res.status(400).json({ error: 'Formato no válido. Use "csv" o "json"' });
        }
        
    } catch (error) {
        console.error('Error en exportación:', error);
        res.status(500).json({ 
            error: 'Error al exportar datos', 
            details: error.message 
        });
    }
});
// ============================================
// ENDPOINTS DE PRUEBA
// ============================================

app.get('/test', (req, res) => {
    res.json({ 
        message: '¡Servidor funcionando! 🚀',
        mongodb: mongoose.connection.readyState === 1 ? 'Conectado' : 'No Conectado'});
});



app.post('/api/esp32/data', async (req, res) => {
  try {
  
    const { dispositivo, porcentaje } = req.body;
    
    if (!dispositivo || porcentaje === undefined) {
      return res.json({ success: false, error: 'Faltan datos' });
    }
    
    const nuevoRegistro = new WaterLevel({
      sensor: dispositivo,      // 'sensor' en el modelo
      value: parseFloat(porcentaje),  // 'value' en el modelo
      // ubicacion y estado se calculan automáticamente por el middleware
    });
    
    await nuevoRegistro.save();
    
    res.json({
      success: true,
      message: 'Guardado en waterlevels',
      data: {
        sensor: nuevoRegistro.sensor,
        value: nuevoRegistro.value,
        volumen: nuevoRegistro.volumen,
        estado: nuevoRegistro.estado,
        ubicacion: nuevoRegistro.ubicacion
      }
    });
  } catch (error) {
    console.error('Error ESP32:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});


// ============================================
// INICIALIZACIÓN
// ============================================

async function iniciarServidor() {
    await cargarConfiguracionInicial();
    
    app.listen(port, () => {
        console.log(`📊 Frecuencia de muestreo: ${intervaloMuestreo}ms`);

    });
}


iniciarServidor();

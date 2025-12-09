const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
// URI de MongoDB (configura como variable en Render)
const MONGODB_URI = process.env.MONGODB_URI;
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let client 

const port = 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Rutas para páginas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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


console.log('🔗 Conectando a MongoDB Atlas...');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
})
.then(() => {
    console.log('✅ CONECTADO A MONGODB ATLAS');
})
.catch((error) => {
    console.log('❌ Error de conexión MongoDB:', error.message);
});

// ============================================
// MODELOS
// ============================================

// Modelo WaterLevel MEJORADO con cálculos automáticos
const WaterLevelSchema = new mongoose.Schema({
    sensor: { 
        type: String, 
        required: true,
        default: 'CAP-SENS-001'
    },
    value: { 
        type: Number, 
        required: true,
        min: 0,
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
        'CAP-SENS-001': 'Tanque Principal',
        'CAP-SENS-002': 'Tanque Reserva',
        'TANQ-SENS-001': 'Cisterna 1',
        'RESV-SENS-001': 'Cisterna 2'
    };
    return mapa[sensorId] || `Sensor ${sensorId}`;
}

// Función para valores por defecto
function calcularValoresPorDefecto(doc, next) {
    doc.volumen = Math.round((doc.value / 100) * 10000);
    doc.estado = doc.value <= 5 ? 'Crítico' : doc.value <= 15 ? 'Advertencia' : 'Normal';
    doc.ubicacion = 'Tanque Principal';
    next();
}

// MIDDLEWARE: Calcula automáticamente volumen, estado, ubicación
WaterLevelSchema.pre('save', async function(next) {
    try {
        console.log(`🧮 Procesando: ${this.sensor} = ${this.value}%`);
        
        // ============================================
        // PARA ESP32 (FUTURO): 
        // El ESP32 solo envía: {sensor: "ID", value: porcentaje}
        // Todo lo demás se calcula automáticamente aquí
        // ============================================
        
        // 1. BUSCAR CONFIGURACIÓN ACTUAL
        const Configuracion = mongoose.model('Configuracions');
        const config = await Configuracion.findOne().sort({ timestamp: -1 });
        
        if (!config) {
            console.log('⚠️ Sin configuración, usando valores por defecto');
            return calcularValoresPorDefecto(this, next);
        }
        
        // 2. USAR CONFIGURACIÓN REAL
        const capacidad = config.cisternaCapacidad || 10000;
        const umbralAlerta = config.umbralAlerta || 15;
        const umbralCritico = config.umbralCritico || 5;
        const muestreo = config.frecuenciaMuestreo || 10000;
        
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
        
       
        
        console.log(`✅ Calculado automáticamente:`);
        console.log(`   📏 ${this.value}% → ${this.volumen}L (de ${capacidad}L)`);
        console.log(`   ⚠️ Estado: ${this.estado} (A:${umbralAlerta}%, C:${umbralCritico}%)`);
        console.log(`   📍 ${this.ubicacion}`);
        
        next();
        
    } catch (error) {
        console.error('❌ Error en cálculo:', error);
        calcularValoresPorDefecto(this, next);
    }
});

const WaterLevel = mongoose.model('WaterLevel', WaterLevelSchema);


const Configuracion = mongoose.model('Configuracions', {
    cisternaNombre: { type: String, default: 'Cisterna - Sor Juana' },
    cisternaCapacidad: { type: Number, default: 10000 },
    cisternaUbicacion: { type: String, default: 'Edificio G - Sor Juana' },
    cisternaMaterial: { type: String, default: 'Concreto armado' },
    sensorModelo: { type: String, default: 'Sensor Capacitivo XYZ-2000' },
    sensorID: { type: String, default: 'CAP-SENS-001' },
    sensorInstalacion: { type: Date, default: new Date('2024-10-15') },
    sensorPrecision: { type: String, default: '±2%' },
    frecuenciaMuestreo: { type: Number, default: 10001 },
    umbralAlerta: { type: Number, default: 15 },
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
    frecuenciaMuestreo: 10000,
    umbralAlerta: 15,
    umbralCritico: 5
};

async function cargarConfiguracionInicial() {
    try {
        if (mongoose.connection.readyState === 1) {
            const config = await Configuracion.findOne().sort({ timestamp: -1 });
            if (config && config.frecuenciaMuestreo) {
                intervaloMuestreo = config.frecuenciaMuestreo;
                console.log(`frecuencia: ${config.frecuenciaMuestreo}`);
                console.log(`Frecuencia cargada desde DB: ${intervaloMuestreo}ms`);
            }
        }
    } catch (error) {
        console.log('⚠️ Error cargando configuración:', error.message);
    }
}

// Función para iniciar el muestreo (SIMULACIÓN ACTUAL)
function iniciarMuestreo() {
    cargarConfiguracionInicial();
    console.log(` Iniciando SIMULACIÓN cada: ${intervaloMuestreo}ms`);
    
    intervaloID = setInterval(async () => {
        // Simular diferentes sensores
        const sensores = ['CAP-SENS-001', 'CAP-SENS-002', 'TANQ-SENS-001'];
        const sensor = sensores[Math.floor(Math.random() * sensores.length)];
        const value = Math.floor(Math.random() * 100);
        
        const ahora = new Date();
        console.log(`\n⏰ [${ahora.toLocaleTimeString()}] SIMULANDO ${sensor}: ${value}%`);
        
        if (mongoose.connection.readyState === 1) {
            try {
                // ============================================
                // ESTO ES LO QUE HARÁ EL ESP32 EN EL FUTURO:
                // new WaterLevel({ sensor: "ID", value: porcentaje })
                // ============================================
                
                const newReading = new WaterLevel({ 
                    sensor: sensor, 
                    value: value 
                });
                
                await newReading.save();

                
            } catch (error) {
                console.log(`⚠️ Error en simulación: ${error.message}`);
            }
        } else {
            console.log('⚠️ MongoDB desconectado, simulación pausada');
        }
    }, intervaloMuestreo);
}

// ============================================
// APIs EXISTENTES (MANTENIDAS)
// ============================================

app.get('/api/level', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ level: Math.floor(Math.random() * 100) });
        }
        const lastReading = await WaterLevel.findOne().sort({ timestamp: -1 }).maxTimeMS(30000);
        res.json({ level: lastReading ? lastReading.value : Math.floor(Math.random() * 100) });
    } catch (error) {
        res.json({ level: Math.floor(Math.random() * 100) });
    }
});

app.get('/api/configuracion', async (req, res) => {
    try {
        console.log('📡 Solicitando configuración más reciente...');
        
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️  MongoDB desconectado, usando configuración local');
            return res.json(configuracionActual);
        }
        
        const config = await Configuracion.findOne().sort({ timestamp: -1 });
        
        if (!config) {
            console.log('ℹ️  No hay configuraciones guardadas');
            return res.json(configuracionActual);
        }
        
        console.log('✅ Configuración más reciente cargada');
        configuracionActual = config.toObject();
        res.json(config);
        
    } catch (error) {
        console.error('❌ Error cargando configuración:', error.message);
        res.json(configuracionActual);
    }
});

app.post('/api/configuracion', async (req, res) => {
    try {
        console.log('💾 Creando nueva configuración...', req.body);
        
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️  MongoDB desconectado, guardando localmente');
            configuracionActual = { ...configuracionActual, ...req.body };
            return res.json({ 
                success: true, 
                message: 'Configuración guardada (modo sin conexión)', 
                data: configuracionActual 
            });
        }

        const nuevaConfiguracion = new Configuracion({
            ...req.body,
            timestamp: new Date(),
            sensorInstalacion: req.body.sensorInstalacion ? 
                new Date(req.body.sensorInstalacion) : 
                new Date()
        });

        const configGuardada = await nuevaConfiguracion.save();
        
        configuracionActual = configGuardada.toObject();
        
        console.log('✅ Nueva configuración guardada:', configGuardada._id);
        
        res.json({ 
            success: true, 
            message: 'Configuración guardada', 
            data: configGuardada
        });
        
    } catch (error) {
        console.error('❌ Error guardando configuración:', error);
        configuracionActual = { ...configuracionActual, ...req.body };
        res.json({ 
            success: true, 
            message: 'Configuración guardada localmente', 
            data: configuracionActual 
        });
    }
});

app.post('/api/servidor/reiniciar', async (req, res) => {
    try {
        console.log('🔄 SOLICITUD DE REINICIO DE SERVIDOR RECIBIDA');
        
        if (intervaloID) {
            clearInterval(intervaloID);
            console.log('⏹️ Muestreo detenido');
        }
        
        await cargarConfiguracionInicial();
        //iniciarMuestreo();
        
        res.json({ 
            success: true, 
            message: `Servidor reiniciado. Nueva frecuencia: ${intervaloMuestreo}ms` 
        });
        
    } catch (error) {
        console.error('❌ Error reiniciando servidor:', error);
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
// APIs NUEVAS PARA HISTORIAL Y ESP32
// ============================================

// GET /api/records - Para el frontend de historial

app.get('/api/records', async (req, res) => {
    try {
        console.log('📊 Frontend pidiendo historial...');
        
        const { page = 1, limit = 10, fechaInicio, fechaFin, sensor, estado } = req.query;
        console.log('🔍 Parámetros recibidos:', { sensor, estado, fechaInicio, fechaFin });
        
        const filtro = {};
        
        // ============================================
        // 1. FILTRO DE SENSOR (FALTA AGREGAR)
        // ============================================
        if (sensor && sensor !== '') {
            filtro.sensor = sensor;
            console.log('✅ Aplicando filtro sensor:', sensor);
        }
        
        // ============================================
        // 2. FILTRO DE ESTADO (FALTA AGREGAR)  
        // ============================================
        if (estado && estado !== '') {
            filtro.estado = estado;
            console.log('✅ Aplicando filtro estado:', estado);
        }
        
        // ============================================
        // 3. FILTRO DE FECHA (ya lo tienes)
        // ============================================
       if (fechaInicio || fechaFin) {
            // INICIALIZAR timestamp como objeto ANTES de usar
            filtro.timestamp = {};
            if (fechaInicio) {
                const inicio = new Date(fechaInicio);
                inicio.setHours(0, 0, 0, 0);
                filtro.timestamp.$gte = inicio;
                console.log(`📅 Inicio: ${fechaInicio} -> ${inicio.toISOString()}`);
            }
            
            if (fechaFin) {
                const fin = new Date(fechaFin);
                fin.setHours(23, 59, 59, 999);
                filtro.timestamp.$lte = fin;
                console.log(`📅 Fin: ${fechaFin} -> ${fin.toISOString()}`);
            }
        }
        
        console.log('🔍 Filtro completo para MongoDB:', JSON.stringify(filtro, null, 2));
        
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
        
        console.log(`✅ Enviando ${registros.length} registros filtrados`);
        
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
        console.error('❌ Error en /api/records:', error);
        console.error('📋 Detalles:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener historial',
            message: error.message 
        });
    }
});

// ============================================
// API PARA ESP32 (COMENTADA - LISTA PARA FUTURO)
// ============================================

/*
// DESCOMENTAR CUANDO EL ESP32 ESTÉ LISTO
app.post('/api/sensor/data', async (req, res) => {
    try {
        const { sensor, value } = req.body;
        
        // ============================================
        // FORMATO ESPERADO DEL ESP32:
        // {
        //   "sensor": "CAP-SENS-001",  // ID único del sensor
        //   "value": 65.5              // Porcentaje (0-100)
        // }
        // ============================================
        
        console.log(`📡 ESP32 enviando: ${sensor} = ${value}%`);
        
        // Validación básica
        if (!sensor || value === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Se requieren: sensor y value' 
            });
        }
        
        const valorNumero = parseFloat(value);
        if (isNaN(valorNumero) || valorNumero < 0 || valorNumero > 100) {
            return res.status(400).json({ 
                success: false, 
                error: 'Value debe ser número entre 0-100' 
            });
        }
        
        // Crear registro (middleware hará cálculos automáticos)
        const nuevoRegistro = new WaterLevel({
            sensor: sensor,
            value: valorNumero,
            timestamp: new Date()
        });
        
        await nuevoRegistro.save();
        
        console.log(`✅ ESP32: ${sensor} guardado (${value}%)`);
        
        res.json({ 
            success: true, 
            message: 'Datos recibidos',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error con ESP32:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error procesando datos' 
        });
    }
});
*/

// API para simular datos (usar desde Postman o frontend)
app.post('/api/simular/sensor', async (req, res) => {
    try {
        const { sensor = 'CAP-SENS-001', value } = req.body;
        
        console.log(`🎮 Simulando sensor: ${sensor} = ${value}%`);
        
        if (value === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Se requiere value' 
            });
        }
        
        const nuevoRegistro = new WaterLevel({
            sensor: sensor,
            value: parseFloat(value)
        });
        /*
        await nuevoRegistro.save();
        
        res.json({ 
            success: true, 
            message: 'Simulación guardada',
            data: {
                sensor: nuevoRegistro.sensor,
                nivel: nuevoRegistro.value,
                volumen: nuevoRegistro.volumen,
                estado: nuevoRegistro.estado,
                ubicacion: nuevoRegistro.ubicacion
            }
        });*/
        
    } catch (error) {
        console.error('❌ Error en simulación:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Información del sistema
app.get('/api/system/info', async (req, res) => {
    try {
        const info = {
            modo: 'SIMULACIÓN',
            estado: 'Funcionando',
            timestamp: new Date().toISOString(),
            
            endpoints: {
                historial: 'GET /api/records',
                simulacion: 'POST /api/simular/sensor',
                configuracion: 'GET /api/configuracion',
                nivelActual: 'GET /api/level',
                
                // ============================================
                // PARA ESP32 (COMENTADO):
                // esp32: 'POST /api/sensor/data',
                // formato: '{"sensor": "ID", "value": porcentaje}'
                // ============================================
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
        console.log('📤 Solicitud de exportación recibida:', req.query);
        
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
            'sensor': 'sensor',  // En BD es 'sensor', no 'sensor_id'
            'nivel': 'value',    // En BD es 'value', no 'nivel'
            'volumen': 'volumen',
            'estado': 'estado',
            'ubicacion': 'ubicacion'
        };
        
        // Si NO es "todos los datos", aplicar filtros
        if (allData !== 'true') {
            // Mapear filtros frontend a campos backend
            if (sensor) {
                query.sensor = sensor;  // ← Usar 'sensor', no 'sensor_id'
                console.log('✅ Filtro sensor:', sensor);
            }
            if (estado) {
                query.estado = estado;
                console.log('✅ Filtro estado:', estado);
            }
            if (fechaInicio || fechaFin) {
                query.timestamp = {};  // ← Usar 'timestamp', no 'fecha'
                if (fechaInicio) {
                    const inicio = new Date(fechaInicio);
                    inicio.setHours(0, 0, 0, 0);
                    query.timestamp.$gte = inicio;
                    console.log('✅ Filtro fecha inicio:', inicio);
                }
                if (fechaFin) {
                    const fin = new Date(fechaFin);
                    fin.setHours(23, 59, 59, 999);
                    query.timestamp.$lte = fin;
                    console.log('✅ Filtro fecha fin:', fin);
                }
            }
        }
        
        console.log('🔍 Query para MongoDB:', JSON.stringify(query, null, 2));
        
        // 2. Obtener datos (usar WaterLevel, no Record)
        let records = await WaterLevel.find(query)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
        
        console.log(`✅ Encontrados ${records.length} registros`);
        
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
        console.error('❌ Error en exportación:', error);
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
        mongodb: mongoose.connection.readyState === 1 ? 'Conectado' : 'Modo simulación',
        frecuenciaMuestreo: intervaloMuestreo,
        modo: 'SIMULACIÓN ACTIVA',
        endpoints: {
            historial: '/api/records',
            simulacion: '/api/simular/sensor',
            info: '/api/system/info'
        }
    });
});



app.post('/api/data', async (req, res) => {
  try {
    // 1. Guardar en MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('cisterna_db');
    const collection = db.collection('waterlevels');
    
    const document = {
      ...req.body,
      timestamp: new Date()
    };
    
    const result = await collection.insertOne(document);
    await client.close();
    
    // 2. Responder
    res.json({
      success: true,
      insertedId: result.insertedId,
      message: 'Guardado en MongoDB'
    });
    
  } catch (error) {
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
   // iniciarMuestreo();
    
    app.listen(port, () => {
        console.log(`\n🚀 Servidor en http://localhost:${port}`);
        console.log(`📊 Frecuencia de muestreo: ${intervaloMuestreo}ms`);

    });
}


iniciarServidor();



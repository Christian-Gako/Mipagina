const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Rutas para páginas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'historial.html'));
});

app.get('/reportes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reportes.html'));
});

app.get('/configuracion', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'configuracion.html'));
});

// CONEXIÓN A MONGODB
const MONGODB_URI = 'mongodb+srv://ChristianCG:Gako0719caLAbi@cluster0.mwretdh.mongodb.net/cisterna_db?retryWrites=true&w=majority';

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

// Modelos
const WaterLevel = mongoose.model('WaterLevel', {
    value: Number,
    timestamp: { type: Date, default: Date.now }
});

const Configuracion = mongoose.model('Configuracions', {
    cisternaNombre: { type: String, default: 'Cisterna - Sorluana' },
    cisternaCapacidad: { type: Number, default: 10000 },
    cisternaUbicacion: { type: String, default: 'Edificio G - Sor Juana' },
    cisternaMaterial: { type: String, default: 'Concreto armado' },
    sensorModelo: { type: String, default: 'Sensor Capacitivo XYZ-2000' },
    sensorID: { type: String, default: 'CAP-SENS-001' },
    sensorInstalacion: { type: Date, default: new Date('2024-10-15') },
    sensorPrecision: { type: String, default: '±2%' },
    frecuenciaMuestreo: { type: Number, default: 10000 },
    umbralAlerta: { type: Number, default: 15 },
    umbralCritico: { type: Number, default: 5 },
    timestamp: { type: Date, default: Date.now }
});

// Configuración dinámica
let intervaloMuestreo = 10000;
let intervaloID = null;

// Función para cargar configuración al inicio
async function cargarConfiguracionInicial() {
    try {
        if (mongoose.connection.readyState === 1) {
            const config = await Configuracion.findOne().sort({ timestamp: -1 });
            if (config && config.frecuenciaMuestreo) {
                intervaloMuestreo = config.frecuenciaMuestreo;
                console.log(`Frecuencia cargada desde DB: ${intervaloMuestreo}ms`);
            }
        }
    } catch (error) {
        console.log('⚠️ Error cargando configuración:', error.message);
    }
}

// Función para iniciar el muestreo
function iniciarMuestreo() {
    console.log(` Iniciando muestreo cada: ${intervaloMuestreo}ms`);
    
    intervaloID = setInterval(async () => {
        const nuevoNivel = Math.floor(Math.random() * 100);
        console.log(`Dato simulado:`, nuevoNivel + "%");
        
        if (mongoose.connection.readyState === 1) {
            try {
                const newReading = new WaterLevel({ value: nuevoNivel });
                await newReading.save({ maxTimeMS: 15000 });
            } catch (error) {
                console.log('⚠️ No se pudo guardar en MongoDB:', error.message);
            }
        }
    }, intervaloMuestreo);
}

// Datos en memoria
let configuracionActual = {
    cisternaNombre: 'Cisterna - Sorluana',
    cisternaCapacidad: 10000,
    cisternaUbicacion: 'Edificio G - Sor Juana',
    cisternaMaterial: 'Concreto armado',
    sensorModelo: 'Sensor Capacitivo XYZ-2000',
    sensorID: 'CAP-SENS-001',
    sensorInstalacion: '2024-10-15',
    sensorPrecision: '±2%',
    frecuenciaMuestreo: 10000,
    umbralAlerta: 15,
    umbralCritico: 5
};

// API Routes
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
        
        // Obtener la configuración MÁS RECIENTE (último documento creado)
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

        // SIEMPRE crear un nuevo documento (nunca actualizar)
        const nuevaConfiguracion = new Configuracion({
            ...req.body,
            timestamp: new Date(),
            // Asegurar formato de fecha
            sensorInstalacion: req.body.sensorInstalacion ? 
                new Date(req.body.sensorInstalacion) : 
                new Date()
        });

        const configGuardada = await nuevaConfiguracion.save();
        
        // Actualizar configuración en memoria
        configuracionActual = configGuardada.toObject();
        
        console.log('✅ Nueva configuración guardada:', configGuardada._id);
        
        res.json({ 
            success: true, 
            message: 'Configuración guardada', 
            data: configGuardada
        });
        
    } catch (error) {
        console.error('❌ Error guardando configuración:', error);
        // Fallback: guardar localmente
        configuracionActual = { ...configuracionActual, ...req.body };
        res.json({ 
            success: true, 
            message: 'Configuración guardada localmente', 
            data: configuracionActual 
        });
    }
});

// ✅ NUEVA API PARA REINICIAR SERVIDOR
app.post('/api/servidor/reiniciar', async (req, res) => {
    try {
        console.log('🔄 SOLICITUD DE REINICIO DE SERVIDOR RECIBIDA');
        
        // Detener el muestreo actual
        if (intervaloID) {
            clearInterval(intervaloID);
            console.log('⏹️ Muestreo detenido');
        }
        
        // Cargar nueva configuración
        await cargarConfiguracionInicial();
        
        // Reiniciar muestreo con nueva configuración
        iniciarMuestreo();
        
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

app.get('/test', (req, res) => {
    res.json({ 
        message: '¡Servidor funcionando! 🚀',
        mongodb: mongoose.connection.readyState === 1 ? 'Conectado' : 'Modo simulación',
        frecuenciaMuestreo: intervaloMuestreo
    });
});

// Inicializar servidor
async function iniciarServidor() {
    await cargarConfiguracionInicial();
    iniciarMuestreo();
    
    app.listen(port, () => {
        console.log(`🚀 Servidor en http://localhost:${port}`);
        console.log(`📊 Frecuencia de muestreo: ${intervaloMuestreo}ms`);
        console.log(`🧪 Test: http://localhost:${port}/test`);
    });
}

iniciarServidor();
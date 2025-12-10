// routes/auth.js - VERSIÓN COMPLETA CON LOGGING Y DEBUG
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Configurar JWT_SECRET con fallback para desarrollo
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ ADVERTENCIA: JWT_SECRET no está definido en variables de entorno');
    console.error('   En Render: Ve a Environment → Add Environment Variable');
    console.error('   Nombre: JWT_SECRET');
    console.error('   Valor: una_clave_secreta_muy_larga');
}

// ========== LOGIN ENDPOINT ==========
router.post('/login', async (req, res) => {
    console.log('🔐 === INICIO LOGIN ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Client IP:', req.ip);
    console.log('Request body recibido:', {
        username: req.body.username,
        passwordLength: req.body.password ? req.body.password.length : 0
    });
    
    try {
        const { username, password } = req.body;
        
        // Validar campos
        if (!username || !password) {
            console.log('❌ Validación fallida: campos vacíos');
            return res.status(400).json({ 
                success: false, 
                error: 'Usuario y contraseña son requeridos' 
            });
        }
        
        console.log(`🔍 Buscando usuario en BD: "${username}"`);
        
        // Buscar usuario (primero exacto, luego case-insensitive)
        let user = await User.findOne({ username: username });
        
        if (!user) {
            console.log(`⚠️  Usuario "${username}" no encontrado (búsqueda exacta)`);
            user = await User.findOne({ 
                username: { $regex: new RegExp('^' + username + '$', 'i') }
            });
            
            if (user) {
                console.log(`✅ Usuario encontrado (case-insensitive): ${user.username}`);
            } else {
                console.log(`❌ Usuario "${username}" no existe en la base de datos`);
                return res.status(401).json({ 
                    success: false, 
                    error: 'Credenciales incorrectas'
                });
            }
        } else {
            console.log(`✅ Usuario encontrado (exacto): ${user.username}`);
        }
        
        // Verificar que el usuario esté activo
        if (user.isActive === false) {
            console.log(`❌ Usuario ${user.username} está inactivo`);
            return res.status(401).json({ 
                success: false, 
                error: 'Cuenta desactivada' 
            });
        }
        
        // Verificar contraseña
        console.log('🔑 Verificando contraseña...');
        console.log(`   Hash en BD: ${user.password.substring(0, 30)}...`);
        
        const isValid = await bcrypt.compare(password, user.password);
        console.log(`   Resultado bcrypt.compare: ${isValid}`);
        
        if (!isValid) {
            console.log(`❌ Contraseña incorrecta para usuario: ${user.username}`);
            return res.status(401).json({ 
                success: false, 
                error: 'Credenciales incorrectas' 
            });
        }
        
        // Actualizar última conexión
        console.log('📝 Actualizando última conexión...');
        user.lastConnection = new Date();
        await user.save();
        
        // Verificar JWT_SECRET
        if (!JWT_SECRET) {
            console.error('❌ ERROR CRÍTICO: JWT_SECRET no definido');
            return res.status(500).json({
                success: false,
                error: 'Error de configuración del servidor'
            });
        }
        
        // Crear token JWT
        console.log('🎫 Generando token JWT...');
        const tokenPayload = { 
            userId: user._id.toString(), 
            username: user.username,
            role: user.role,
            name: user.name,
            email: user.email
        };
        
        console.log('   Payload del token:', tokenPayload);
        
        const token = jwt.sign(
            tokenPayload,
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        console.log(`✅ Token generado (${token.length} caracteres)`);
        
        // Respuesta exitosa
        const responseData = {
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                lastConnection: user.lastConnection,
                createdAt: user.createdAt
            },
            expiresIn: '8h'
        };
        
        console.log('🎉 Login exitoso para:', user.username);
        console.log('   Role:', user.role);
        console.log('   Email:', user.email);
        console.log('=== FIN LOGIN EXITOSO ===\n');
        
        res.json(responseData);
        
    } catch (error) {
        console.error('💥 ERROR EN LOGIN:', error);
        console.error('   Stack:', error.stack);
        
        // Errores específicos
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            console.error('   ⚠️  Error de MongoDB');
            return res.status(500).json({
                success: false,
                error: 'Error de base de datos'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            console.error('   ⚠️  Error de JWT');
            return res.status(500).json({
                success: false,
                error: 'Error de configuración del servidor'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log('🔐 Middleware authenticateToken llamado');
    console.log('   Ruta:', req.path);
    console.log('   Authorization header:', authHeader ? 'Presente' : 'Ausente');
    
    if (!token) {
        console.log('❌ Token no proporcionado');
        return res.status(401).json({ 
            success: false, 
            error: 'Token no proporcionado' 
        });
    }
    
    if (!JWT_SECRET) {
        console.error('❌ JWT_SECRET no configurado');
        return res.status(500).json({
            success: false,
            error: 'Error de configuración del servidor'
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('❌ Token inválido:', err.message);
            
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Token expirado',
                    expired: true
                });
            }
            
            return res.status(403).json({ 
                success: false, 
                error: 'Token inválido' 
            });
        }
        
        console.log('✅ Token válido para usuario:', user.username);
        req.user = user;
        next();
    });
};

// ========== RUTAS PROTEGIDAS ==========

// Perfil de usuario
router.get('/profile', authenticateToken, async (req, res) => {
    console.log('👤 Profile endpoint llamado para:', req.user.username);
    
    try {
        const user = await User.findById(req.user.userId).select('-password');
        
        if (!user) {
            console.log('❌ Usuario no encontrado en BD');
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        
        console.log('✅ Perfil enviado:', user.username);
        res.json({
            success: true,
            user
        });
        
    } catch (error) {
        console.error('💥 Error en /profile:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verificar token (para el frontend)
router.post('/verify', (req, res) => {
    console.log('🔍 Verificación de token solicitada');
    const { token } = req.body;
    
    if (!token) {
        console.log('❌ Token no proporcionado para verificación');
        return res.json({ 
            success: false, 
            error: 'Token requerido' 
        });
    }
    
    if (!JWT_SECRET) {
        console.error('❌ JWT_SECRET no configurado');
        return res.json({
            success: false,
            error: 'Error de configuración'
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('❌ Token inválido en verificación:', err.message);
            return res.json({ 
                success: false, 
                error: 'Token inválido',
                expired: err.name === 'TokenExpiredError'
            });
        }
        
        console.log('✅ Token verificado para:', decoded.username);
        res.json({
            success: true,
            user: decoded,
            message: 'Token válido'
        });
    });
});

// ========== RUTAS DE DIAGNÓSTICO ==========

// Endpoint para verificar estado del auth
router.get('/status', (req, res) => {
    console.log('📊 Status endpoint llamado');
    res.json({
        success: true,
        status: 'auth module funcionando',
        timestamp: new Date().toISOString(),
        hasJwtSecret: !!JWT_SECRET,
        jwtSecretLength: JWT_SECRET ? JWT_SECRET.length : 0,
        environment: process.env.NODE_ENV || 'not set'
    });
});

// Endpoint para listar usuarios (solo desarrollo)
if (process.env.NODE_ENV === 'development') {
    router.get('/debug/users', async (req, res) => {
        try {
            const users = await User.find().select('username email role isActive createdAt');
            res.json({
                success: true,
                count: users.length,
                users
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
}

// ========== RUTA DE PRUEBA PÚBLICA ==========
router.get('/test', (req, res) => {
    console.log('🧪 Test endpoint público llamado');
    res.json({
        success: true,
        message: 'Módulo de autenticación funcionando',
        timestamp: new Date().toISOString(),
        path: '/api/auth'
    });
});

console.log('✅ Módulo auth.js cargado correctamente');
console.log('   Endpoints disponibles:');
console.log('   - POST /api/auth/login');
console.log('   - GET  /api/auth/profile (protegido)');
console.log('   - POST /api/auth/verify');
console.log('   - GET  /api/auth/status');
console.log('   - GET  /api/auth/test');

module.exports = router;
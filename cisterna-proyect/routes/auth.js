// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validar campos
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Usuario y contraseña son requeridos' 
            });
        }
        
        // Buscar usuario (case insensitive)
        const user = await User.findOne({ 
            username: { $regex: new RegExp('^' + username + '$', 'i') }
        });
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Credenciales incorrectas'  // No revelar si existe o no
            });
        }
        
        // Verificar contraseña
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ 
                success: false, 
                error: 'Credenciales incorrectas' 
            });
        }
        
        // Actualizar última conexión
        user.lastConnection = new Date();
        await user.save();
        
        // Crear token con información importante
        const token = jwt.sign(
            { 
                userId: user._id, 
                username: user.username,
                role: user.role,
                name: user.name
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        // Respuesta exitosa
        res.json({
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
            expiresIn: '8h'  // Para que el frontend sepa
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
//agregando linea random
// Middleware de autenticación (para usar en otras rutas)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Token no proporcionado' 
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                error: 'Token inválido o expirado' 
            });
        }
        
        req.user = user; // Adjuntar info del usuario a la request
        next();
    });
};
// routes/auth.js
router.get('/session-status', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role
            },
            sessionValid: true
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta protegida de ejemplo
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-password'); // Excluir contraseña
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        
        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verificar token (para el frontend)
router.post('/verify', (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.json({ 
            success: false, 
            error: 'Token requerido' 
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.json({ 
                success: false, 
                error: 'Token inválido',
                expired: err.name === 'TokenExpiredError'
            });
        }
        
        res.json({
            success: true,
            user: decoded,
            message: 'Token válido'
        });
    });
});

module.exports = router;
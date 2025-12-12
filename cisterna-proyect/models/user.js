// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true,
        index: true 
    },
    email: {
        type: String,
        required: [true, 'El email es requerido'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Por favor ingresa un email válido'],
        index: true
        
    },
    username: {
        type: String,
        required: [true, 'El usuario es requerido'],
        unique: true,
        trim: true,
        minlength: [3, 'El usuario debe tener al menos 3 caracteres'],
        index: true
    },
    password: {
        type: String,
        required: [true, 'La contraseña es requerida'],
        index: true
    },
    role: {
        type: String,
        default: 'desconocido',
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    lastConnection: {
        type: Date,
        default: null,
        index: true
    },
    
}, {
    timestamps: true // Agrega createdAt y updatedAt automáticamente
});

// Middleware para encriptar contraseña antes de guardar
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
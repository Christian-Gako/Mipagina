// add-user-bcrypt.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ========== CONFIGURA ESTO ==========
const MONGODB_URI = 'mongodb+srv://ChristianCG:Gako0719caLAbi@cluster0.mwretdh.mongodb.net/cisterna_db?retryWrites=true&w=majority'; // ← CAMBIA

const USER_DATA = {
    name: "Administrador1",      // ← CAMBIA
    email: "admin1@tesch.edu.mx",      // ← CAMBIA  
    username: "admin",                // ← CAMBIA
    password: "m14m1g0123$",            // ← CAMBIA (mínimo 6 caracteres)
    role: "admin",                   
    isActive: true
};
// =====================================

async function addUserWithBcrypt() {
    console.log('🔐 Creando usuario con contraseña encriptada...');
    console.log('Usuario:', USER_DATA.username);
    
    try {
        // Conectar
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB conectado');

        // Esquema
        const userSchema = new mongoose.Schema({
            name: { type: String, required: true },
            email: { type: String, required: true, unique: true },
            username: { type: String, required: true, unique: true },
            password: { type: String, required: true },
            role: { type: String, required: true },
            isActive: { type: Boolean, default: true },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        });

        const User = mongoose.model('User', userSchema);

        // Verificar existencia
        const existing = await User.findOne({ 
            $or: [
                { username: USER_DATA.username },
                { email: USER_DATA.email }
            ] 
        });

        if (existing) {
            console.log(`⚠️  Usuario ya existe: ${USER_DATA.username}`);
            console.log(`   ¿Quieres actualizar la contraseña?`);
            console.log(`   Ejecuta en MongoDB:`);
            console.log(`   db.users.updateOne({username:"${USER_DATA.username}"}, {$set:{password:"NUEVO_HASH"}})`);
            process.exit(1);
        }

        // Encriptar contraseña
        console.log('🔒 Encriptando contraseña...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(USER_DATA.password, salt);
        
        // Crear usuario con password encriptado
        const userToSave = { ...USER_DATA, password: hashedPassword };
        const newUser = new User(userToSave);
        await newUser.save();

        console.log('✅ USUARIO CREADO CON ÉXITO');
        console.log('='.repeat(50));
        console.log(`👤 Nombre: ${newUser.name}`);
        console.log(`📧 Email: ${newUser.email}`);
        console.log(`🔑 Usuario: ${newUser.username}`);
        console.log(`🔐 Contraseña (original): ${USER_DATA.password}`);
        console.log(`🔐 Contraseña (encriptada): ${hashedPassword.substring(0, 30)}...`);
        console.log(`🎯 Rol: ${newUser.role}`);
        console.log(`🆔 ID: ${newUser._id}`);
        console.log('='.repeat(50));
        
        console.log('\n🎯 PARA LOGIN USAR:');
        console.log(`   Usuario: ${USER_DATA.username}`);
        console.log(`   Contraseña: ${USER_DATA.password}`);

        console.log('\n⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro');
        
        process.exit(0);

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        process.exit(1);
    }
}

addUserWithBcrypt();
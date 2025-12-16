// login.js - VERSIÓN CORREGIDA
const API_URL = 'https://simona-9e42.onrender.com/api';

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const alertMessage = document.getElementById('alertMessage');
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

// ========== VERIFICACIÓN INICIAL ==========
console.log('📄 login.js: Inicializando...');
console.log('📍 URL actual:', window.location.href);
console.log('📍 Pathname:', window.location.pathname);

// Mostrar/ocultar contraseña
togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
});

// Manejar login
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validaciones
    if (!username || !password) {
        showAlert('Por favor, complete todos los campos', 'error');
        return;
    }
    
    if (username.length < 3) {
        showAlert('El usuario debe tener al menos 3 caracteres', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAlert('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    // Mostrar estado de carga
    setLoading(true);
    showAlert('Verificando credenciales...', 'info');
    
    try {
        console.log('🔐 Enviando credenciales a:', `${API_URL}/auth/login`);
        console.log('👤 Usuario:', username);
        
        // Intentar autenticación con el servidor
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                username, 
                password 
            }),
            signal: AbortSignal.timeout(10000)
        });
        
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Login exitoso
            console.log('✅ Login exitoso para:', data.user.username);
            console.log('🔑 Token recibido:');
            
            showAlert('✓ Autenticación exitosa', 'success');
            
            // Guardar datos de sesión en SESSIONSTORAGE
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('userData', JSON.stringify(data.user));
            sessionStorage.setItem('lastLogin', new Date().toISOString());
            
            console.log('💾 Datos guardados en sessionStorage:');
            console.log('  - authToken:', sessionStorage.getItem('authToken') ? 'GUARDADO' : 'ERROR');
            console.log('  - userData:', sessionStorage.getItem('userData') ? 'GUARDADO' : 'ERROR');
            
            // Verificar que realmente se guardó
            const tokenGuardado = sessionStorage.getItem('authToken');
            if (!tokenGuardado || tokenGuardado !== data.token) {
                console.error('❌ ERROR: Token NO se guardó correctamente en sessionStorage');
                showAlert('Error guardando sesión', 'error');
                return;
            }
            
            console.log('🔄 Redirigiendo a /dashboard en 1 segundo...');
            
            // Redirigir después de 1 segundo
            setTimeout(() => {
                console.log('🚀 Redirección ejecutándose...');
                window.location.href = '/dashboard';
            }, 10000);
            
        } else {
            // Login fallido
            const errorMsg = data.error || 'Credenciales incorrectas';
            console.log('❌ Login fallido:', errorMsg);
            
            showAlert(`✗ ${errorMsg}`, 'error');
            passwordInput.focus();
            
            // Limpiar campos por seguridad
            document.getElementById('password').value = '';
        }
        
    } catch (error) {
        // Error de red o timeout
        console.error('❌ Error de conexión:', error);
        
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            showAlert('⏱️ Tiempo de espera agotado', 'error');
        } else if (error.name === 'TypeError') {
            showAlert('🌐 Error de conexión', 'error');
        } else {
            showAlert('⚠️ Error inesperado', 'error');
        }
        
    } finally {
        setLoading(false);
    }
});

// Funciones auxiliares
function showAlert(message, type = 'error') {
    alertMessage.textContent = message;
    alertMessage.className = `alert alert-${type}`;
    alertMessage.style.display = 'block';
    
    const hideTime = type === 'success' ? 2000 : 5000;
    setTimeout(() => {
        if (alertMessage.textContent === message) {
            alertMessage.style.display = 'none';
        }
    }, hideTime);
}

function setLoading(isLoading) {
    if (isLoading) {
        loginBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'block';
    } else {
        loginBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
    }
}

// Prevenir múltiples envíos
let isSubmitting = false;
loginForm.addEventListener('submit', function(e) {
    if (isSubmitting) {
        e.preventDefault();
        return;
    }
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 2000);
});

// Auto-focus en campo de usuario
window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('username').focus();
});

// Limpiar mensajes al empezar a escribir
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
        if (alertMessage.style.display === 'block') {
            alertMessage.style.display = 'none';
        }
    });
});

// ========== VERIFICACIÓN DE SESSIONSTORAGE ==========
// Función para verificar sessionStorage
function verificarSessionStorage() {
    console.log('🔍 Verificando sessionStorage:');
    console.log('  - Soporte sessionStorage:', typeof sessionStorage !== 'undefined' ? 'SÍ' : 'NO');
    console.log('  - authToken:', sessionStorage.getItem('authToken') ? 'EXISTE' : 'NO EXISTE');
    console.log('  - userData:', sessionStorage.getItem('userData') ? 'EXISTE' : 'NO EXISTE');
    
    // Probar escritura/lectura
    try {
        const testKey = '__test_login_' + Date.now();
        sessionStorage.setItem(testKey, 'test_value');
        const readValue = sessionStorage.getItem(testKey);
        sessionStorage.removeItem(testKey);
        
        console.log('  - Lectura/escritura funcional:', readValue === 'test_value' ? 'SÍ' : 'NO');
    } catch (error) {
        console.error('  - ERROR sessionStorage:', error);
    }
}
// Al INICIO de login.js, después de las constantes:
console.log('📄 login.js: Inicializando...');

// VERIFICAR ELEMENTOS DEL DOM
function verificarDOM() {
    console.log('🔍 Verificando elementos DOM:');
    
    const elementos = {
        'loginForm': document.getElementById('loginForm'),
        'username': document.getElementById('username'),
        'password': document.getElementById('password'),
        'loginBtn': document.getElementById('loginBtn'),
        'alertMessage': document.getElementById('alertMessage'),
        'loginContainer': document.querySelector('.login-container'),
        'loginCard': document.querySelector('.login-card')
    };
    
    Object.keys(elementos).forEach(key => {
        console.log(`  ${key}:`, elementos[key] ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
    });
    
    // Si falta el formulario, mostrar error
    if (!elementos.loginForm) {
        console.error('❌ ERROR CRÍTICO: Formulario de login NO encontrado');
        document.body.innerHTML = `
            <div style="padding: 50px; text-align: center; font-family: Arial;">
                <h1 style="color: red;">ERROR: Formulario no encontrado</h1>
                <p>El formulario de login no se pudo cargar.</p>
                <p>URL: ${window.location.href}</p>
                <p>Path: ${window.location.pathname}</p>
                <button onclick="location.reload()">Recargar página</button>
            </div>
        `;
    }
}

// Ejecutar verificación inmediatamente
verificarDOM();

// Ejecutar verificación al cargar
window.addEventListener('DOMContentLoaded', verificarSessionStorage);

// ========== FIX PARA RENDER (URL sin barra) ==========
// Si estamos en la raíz sin barra, asegurar redirección
(function() {
    const currentUrl = window.location.href;
    const origin = window.location.origin;
    
    
    if (currentUrl === origin) {
        console.log('⚠️  Detectado: URL raíz sin barra (/), verificando...');
        
        // Si NO tenemos token y estamos en raíz sin barra → todo OK
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            console.log('✅ Usuario no autenticado en raíz sin barra - mostrar login');
        } else {
            console.log('🔄 Usuario autenticado en raíz sin barra, redirigiendo...');
            window.location.href = '/dashboard';
        }
    }
})();
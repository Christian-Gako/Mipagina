// login.js - VERSIÓN COMPLETA Y CORREGIDA
const API_URL = 'https://simona-9e42.onrender.com/api';

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const alertMessage = document.getElementById('alertMessage');
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');

// ========== FUNCIONES AUXILIARES ==========
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
        btnLoader.style.display = 'inline-block';
    } else {
        loginBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

function checkExistingSession() {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
        try {
            const user = JSON.parse(userData);
            const lastLogin = localStorage.getItem('lastLogin');
            const hoursSinceLogin = lastLogin ? 
                (new Date() - new Date(lastLogin)) / (1000 * 60 * 60) : 24;
            
            if (hoursSinceLogin < 8) {
                console.log(`✅ Sesión activa encontrada: ${user.username}`);
                window.location.href = 'index.html';
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
                showAlert('Sesión expirada. Por favor, inicie sesión nuevamente.', 'error');
            }
        } catch (e) {
            localStorage.clear();
        }
    }
}

// ========== EVENT LISTENERS ==========

// Mostrar/ocultar contraseña
if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });
}

// Auto-focus en campo de usuario
if (usernameInput) {
    usernameInput.focus();
}

// Limpiar mensajes al escribir
if (usernameInput && passwordInput) {
    [usernameInput, passwordInput].forEach(input => {
        input.addEventListener('input', () => {
            if (alertMessage.style.display === 'block') {
                alertMessage.style.display = 'none';
            }
        });
    });
}

// Prevenir múltiples envíos
let isSubmitting = false;

// ========== MANEJAR LOGIN ==========
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (isSubmitting) {
            return;
        }
        isSubmitting = true;
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        // Validaciones
        if (!username || !password) {
            showAlert('Por favor, complete todos los campos', 'error');
            isSubmitting = false;
            return;
        }
        
        if (username.length < 3) {
            showAlert('El usuario debe tener al menos 3 caracteres', 'error');
            isSubmitting = false;
            return;
        }
        
        if (password.length < 6) {
            showAlert('La contraseña debe tener al menos 6 caracteres', 'error');
            isSubmitting = false;
            return;
        }
        
        // Mostrar estado de carga
        setLoading(true);
        showAlert('Verificando credenciales...', 'info');
        
        try {
            console.log('🔐 Intentando login con:', { username, passwordLength: password.length });
            
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    username, 
                    password 
                }),
                signal: AbortSignal.timeout(15000)
            });
            
            console.log('📡 Respuesta del servidor - Status:', response.status);
            
            // Intentar parsear JSON
            let data;
            try {
                data = await response.json();
                console.log('📡 Respuesta JSON:', data);
            } catch (jsonError) {
                console.error('❌ Error al parsear JSON:', jsonError);
                const text = await response.text();
                console.error('📄 Respuesta como texto:', text.substring(0, 200));
                throw new Error('Respuesta inválida del servidor');
            }
            
            if (response.ok && data.success) {
                // Login exitoso
                showAlert('✅ Autenticación exitosa. Redirigiendo...', 'success');
                
                // Guardar datos de sesión
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('lastLogin', new Date().toISOString());
                
                console.log('🎉 Login exitoso:', {
                    user: data.user.username,
                    role: data.user.role,
                    tokenLength: data.token?.length
                });
                
                // Redirigir después de 1 segundo
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                
            } else {
                // Login fallido
                const errorMsg = data.error || data.message || 'Credenciales incorrectas';
                console.log('❌ Login fallido:', errorMsg);
                
                showAlert(`❌ ${errorMsg}`, 'error');
                passwordInput.value = '';
                passwordInput.focus();
            }
            
        } catch (error) {
            console.error('💥 Error en login:', error);
            
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                showAlert('⏱️ Tiempo de espera agotado. El servidor no responde.', 'error');
            } else if (error.name === 'TypeError') {
                showAlert('🌐 Error de conexión. Verifique su conexión a internet.', 'error');
            } else {
                showAlert(`🚨 Error: ${error.message}`, 'error');
            }
            
        } finally {
            setLoading(false);
            setTimeout(() => { isSubmitting = false; }, 2000);
        }
    });
}

// ========== VERIFICAR SESIÓN AL CARGAR ==========
window.addEventListener('DOMContentLoaded', checkExistingSession);

// ========== ATALHOS DE TECLADO ==========
document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+L para limpiar localStorage (debug)
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        localStorage.clear();
        console.log('🧹 localStorage limpiado');
        showAlert('LocalStorage limpiado', 'info');
    }
    
    // Ctrl+Enter para enviar formulario
    if (e.ctrlKey && e.key === 'Enter' && loginForm) {
        loginForm.requestSubmit();
    }
});

// ========== PRUEBA DE CONEXIÓN INICIAL ==========
window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${API_URL}/system/info`, {
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Servidor conectado:', data.estado);
        } else {
            console.warn('⚠️ Servidor respondió con error:', response.status);
        }
    } catch (error) {
        console.warn('⚠️ No se pudo conectar al servidor:', error.message);
    }
});

// ========== EXPORT PARA DEBUG (opcional) ==========
if (typeof window !== 'undefined') {
    window.debugLogin = {
        clearStorage: () => {
            localStorage.clear();
            console.log('Storage limpiado');
            showAlert('Storage limpiado', 'info');
        },
        testConnection: async () => {
            try {
                const response = await fetch(`${API_URL}/system/info`);
                console.log('Test connection:', response.status, await response.json());
            } catch (error) {
                console.error('Test connection failed:', error);
            }
        },
        getCurrentUser: () => {
            const userData = localStorage.getItem('userData');
            return userData ? JSON.parse(userData) : null;
        }
    };
}
// login.js - VERSIÓN CORREGIDA
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const alertMessage = document.getElementById('alertMessage');
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

const API_URL = '/api';
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
            signal: AbortSignal.timeout(20000)
        });
        
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            
            showAlert('✓ Autenticación exitosa', 'success');
            
            // Guardar datos de sesión en SESSIONSTORAGE
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('userData', JSON.stringify(data.user));
            sessionStorage.setItem('lastLogin', new Date().toISOString());
            
            // Verificar que realmente se guardó
            const tokenGuardado = sessionStorage.getItem('authToken');
            if (!tokenGuardado || tokenGuardado !== data.token) {
                showAlert('Error guardando sesión', 'error');
                return;
            }
            
            
            // Redirigir después de 1 segundo
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1000);
            
        } else {
            // Login fallido
            const errorMsg = data.error || 'Credenciales incorrectas';
            console.log('Login fallido:', errorMsg);
            
            showAlert(`✗ ${errorMsg}`, 'error');
            passwordInput.focus();
            
            // Limpiar campos por seguridad
            document.getElementById('password').value = '';
        }
        
    } catch (error) {
        // Error de red o timeout
        
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            showAlert('Tiempo de espera agotado', 'error');
        } else if (error.name === 'TypeError') {
            showAlert('Error de conexión', 'error');
        } else {
            showAlert('Error inesperado', 'error');
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
    
    const hideTime = type === 'success' ? 5000 : 8000;
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



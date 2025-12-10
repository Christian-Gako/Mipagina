if (!sessionStorage.getItem('authToken')) {
    window.location.href = 'login.html';
    throw new Error('No autenticado');
}
        const API_URL = 'https://simona-9e42.onrender.com/api';
        
        // Elementos del DOM
        const loginForm = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');
        const btnText = document.getElementById('btnText');
        const btnLoader = document.getElementById('btnLoader');
        const alertMessage = document.getElementById('alertMessage');
        const togglePassword = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');

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
                console.log("given: ",username, " and ",password);
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        username, 
                        password 
                    }),
                    // Timeout de 10 segundos
                    signal: AbortSignal.timeout(10000)
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Login exitoso
                    showAlert(' Autenticación exitosa. Redirigiendo...', 'success');
                    
                    // Guardar datos de sesión
                    sessionStorage.setItem('authToken', data.token);
                    sessionStorage.setItem('userData', JSON.stringify(data.user));

                    sessionStorage.setItem('lastLogin', new Date().toISOString());
                    console.log("token: ",data.token);
                    
                    // Registrar login exitoso
                    console.log(`Login exitoso: ${data.user.username} (${data.user.role})`);
                    
                    // Redirigir después de 1 segundo
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                    
                } else {
                    // Login fallido
                    const errorMsg = data.error || 'Credenciales incorrectas';
                    
                    showAlert(` ${errorMsg}`, 'error');
                    passwordInput.focus();
                    
                    // Registrar intento fallido
                    console.warn(`Intento fallido de login: ${username}`);
                }
                
            } catch (error) {
                // Error de red o timeout
                console.error('Error de conexión:', error);
                
                if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                    showAlert('Tiempo de espera agotado. El servidor no responde.', 'error');
                } else if (error.name === 'TypeError') {
                    showAlert('Error de conexión. Verifique su conexión a internet.', 'error');
                } else {
                    showAlert('Error inesperado. Contacte al administrador.', 'error');
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
            
            // Auto-ocultar después de tiempo
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

    

        // Verificar si ya hay sesión activa
        function checkExistingSession() {
            const token = sessionStorage.getItem('authToken');
            const userData = sessionStorage.getItem('userData');
            
            if (token && userData) {
                try {
                    const user = JSON.parse(userData);
                    const lastLogin = sessionStorage.getItem('lastLogin');
                    const hoursSinceLogin = lastLogin ? 
                        (new Date() - new Date(lastLogin)) / (1000 * 60 * 60) : 24;
                    
                    // Si la sesión es menor a 8 horas, redirigir
                    if (hoursSinceLogin < 8) {
                        console.log(`Sesión activa encontrada: ${user.username}`);
                        window.location.href = 'index.html';
                    } else {
                        // Sesión expirada, limpiar
                        sessionStorage.removeItem('authToken');
                        sessionStorage.removeItem('userData');
                        showAlert('Sesión expirada. Por favor, inicie sesión nuevamente.', 'error');
                    }
                } catch (e) {
                    // Datos corruptos, limpiar
                    sessionStorage.clear();
                }
            }
        }

        // Verificar sesión al cargar
        window.addEventListener('DOMContentLoaded', checkExistingSession);

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
        window.addEventListener('load', () => {
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
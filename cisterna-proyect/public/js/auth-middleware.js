// auth-middleware.js
class AuthMiddleware {
    static API_URL = 'https://simona-9e42.onrender.com/api';

    // Verificar si el usuario está autenticado (solo local)
    static isAuthenticated() {
        const token = sessionStorage.getItem('authToken');
        const userData = sessionStorage.getItem('userData');
        
        if (!token || !userData) {
            return false;
        }
        
        // Verificar si la sesión no ha expirado (8 horas máximo)
        const lastLogin = sessionStorage.getItem('lastLogin');
        if (lastLogin) {
            const hoursSinceLogin = (new Date() - new Date(lastLogin)) / (1000 * 60 * 60);
            if (hoursSinceLogin >= 8) {
                this.clearSession();
                return false;
            }
        }
        
        return true;
    }

    // Limpiar sesión
    static clearSession() {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('lastLogin');
    }

    // Obtener token
    static getToken() {
        return sessionStorage.getItem('authToken');
    }

    // Obtener datos del usuario
    static getUser() {
        const userData = sessionStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    }

    // Validar token con el servidor (opcional)
    static async validateTokenWithServer() {
        const token = this.getToken();
        
        if (!token) {
            return { valid: false, reason: 'No token' };
        }
        
        try {
            const response = await fetch(`${this.API_URL}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            return { valid: data.success, data: data };
            
        } catch (error) {
            console.error('Error validando token:', error);
            return { valid: false, reason: 'Network error' };
        }
    }

    // Configurar interceptor para todas las peticiones fetch
    static setupFetchInterceptor() {
        const originalFetch = window.fetch;
        
        window.fetch = async function(resource, config = {}) {
            // Agregar token a todas las peticiones
            const token = AuthMiddleware.getToken();
            if (token) {
                config.headers = {
                    ...config.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
            
            try {
                const response = await originalFetch(resource, config);
                
                // Si recibe 401 o 403, hacer logout
                if (response.status === 401 || response.status === 403) {
                    console.log('🔐 Token inválido en petición API, redirigiendo...');
                    AuthMiddleware.redirectToLogin();
                }
                
                return response;
            } catch (error) {
                throw error;
            }
        };
    }

    // ========== FUNCIÓN PROTECTPAGE() CORREGIDA ==========
    static protectPage() {
        console.log('🔒 [auth-middleware] protectPage() INICIANDO');
       
        const origin = window.location.origin;
        const currentUrl = window.location.href;
        const isLoginPage = 

            currentUrl === origin + '/';
        
        
        const token = sessionStorage.getItem('authToken');
        const userData = sessionStorage.getItem('userData');
        
        // 2. SI ESTAMOS EN LOGIN PAGE
        if (isLoginPage) {
            
            // Si YA está autenticado → REDIRIGIR a DASHBOARD
            if (token && userData) {
                console.log('🔄 Usuario YA autenticado, redirigiendo a DASHBOARD');
                //window.location.href = '/dashboard';
                return false; // No permitir acceso al login
            }
            
            console.log('✅ Mostrar formulario de login (usuario no autenticado)');
            return true; // Permitir acceso al login
        }
        
        // Si NO está autenticado → REDIRIGIR a LOGIN
        if (!token || !userData) {
            console.log('🚫 Usuario NO autenticado, redirigiendo a LOGIN');
            this.redirectToLogin();
            return false;
        }
        
        // 4. USUARIO AUTENTICADO EN PÁGINA PROTEGIDA → PERMITIR
        console.log('✅ Acceso PERMITIDO: Usuario autenticado');
        return true;
    }

    // ========== FUNCIÓN REDIRECTTOLOGIN() CORREGIDA ==========
    static redirectToLogin() {
        // Limpiar sesión primero
        this.clearSession();
        const rootUrl = window.location.origin + '/';
        console.log('🔀 Redirigiendo a LOGIN:', rootUrl);
        
        // Usar location.replace para evitar que quede en el historial
        window.location.replace(rootUrl);
    }
}

// ========== INICIALIZACIÓN AUTOMÁTICA ==========
(function() {
    // Solo ejecutar en navegador
    if (typeof window !== 'undefined') {
        // Verificar si ya está cargado
        if (!window.AuthMiddlewareInitialized) {
            console.log('✅ Configurando interceptor fetch...');
            AuthMiddleware.setupFetchInterceptor();
            window.AuthMiddlewareInitialized = true;
            
            // También ejecutar protectPage() automáticamente para seguridad
            setTimeout(() => {
                console.log('🛡️ auth-middleware.js: Ejecutando verificación automática...');
                AuthMiddleware.protectPage();
            }, 50);
        } else {
            console.log('⏭️ auth-middleware.js: Ya estaba inicializado');
        }
    }
})();


// Exportar para que esté disponible globalmente
if (typeof window !== 'undefined') {
    window.AuthMiddleware = AuthMiddleware;
}
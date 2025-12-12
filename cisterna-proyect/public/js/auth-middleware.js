// auth-middleware.js - VERSIÓN FINAL CORREGIDA
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
                    AuthMiddleware.redirectToLogin();
                }
                
                return response;
            } catch (error) {
                throw error;
            }
        };
    }

    // Proteger página
    static protectPage() {
        const currentPath = window.location.pathname;
        const token = sessionStorage.getItem('authToken');
        const userData = sessionStorage.getItem('userData');
        
        // 1. PÁGINAS PÚBLICAS (solo / y /login)
        if (currentPath === '/' || currentPath === '/login') {
            // Si YA está autenticado → redirigir a dashboard
            if (token && userData) {
                window.location.href = '/dashboard';
                return false;
            }
            // Si NO está autenticado → permitir acceso
            return true;
        }
        
        // 2. PÁGINAS PROTEGIDAS (todas las demás)
        if (!token || !userData) {
            this.redirectToLogin();
            return false;
        }
        
        // 3. USUARIO AUTENTICADO → permitir acceso
        return true;
    }
    // Redirigir al login
    static redirectToLogin() {
        this.clearSession();
        window.location.href = '/';
    }
}

// Inicializar interceptor automáticamente cuando se carga el script
(function() {
    // Solo ejecutar en navegador
    if (typeof window !== 'undefined') {
        // Verificar si ya está cargado
        if (!window.AuthMiddlewareInitialized) {
            AuthMiddleware.setupFetchInterceptor();
            window.AuthMiddlewareInitialized = true;
        }
    }
})();
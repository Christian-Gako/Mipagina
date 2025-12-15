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

        // En auth-middleware.js, modifica protectPage():
    static protectPage() {
        console.log('🔒 [auth-middleware] protectPage() INICIANDO');
        console.log('📍 Ruta actual:', window.location.pathname);
        console.log('🔑 Token en sessionStorage:', sessionStorage.getItem('authToken') ? 'SÍ' : 'NO');
        console.log('👤 UserData en sessionStorage:', sessionStorage.getItem('userData') ? 'SÍ' : 'NO');
        
        const currentPath = window.location.pathname;
        const token = sessionStorage.getItem('authToken');
        const userData = sessionStorage.getItem('userData');
        
        // Si estamos en la página de login ("/")
        if (currentPath === '/') {
            console.log('📄 Estamos en la página de login (/)');
            
            // Si YA está autenticado → redirigir a dashboard
            if (token && userData) {
                console.log('🔄 Usuario YA autenticado, redirigiendo a /dashboard');
                window.location.href = '/dashboard';
                return false;
            }
            
            console.log('✅ Usuario NO autenticado, mostrar formulario de login');
            return true; // Permitir acceso al login
        }
        
        // Si estamos en CUALQUIER OTRA página y NO está autenticado
        if (!token || !userData) {
            console.log('🚫 Usuario NO autenticado para página protegida, redirigiendo a /');
            this.redirectToLogin();
            return false;
        }
        
        // Usuario autenticado en página protegida → PERMITIR ACCESO
        console.log('✅ Usuario autenticado, permitir acceso');
        return true;
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

// Al final de auth-middleware.js, después de todo:
(function() {
    if (typeof window !== 'undefined') {
        // Esperar 100ms para que todo cargue, luego verificar
        setTimeout(() => {
            console.log('⏰ Verificación de seguridad ejecutándose...');
            
            const currentPath = window.location.pathname;
            const token = sessionStorage.getItem('authToken');
            const userData = sessionStorage.getItem('userData');
            
            // REGLA DE SEGURIDAD: Si estamos en "/" y tenemos token, redirigir
            if (currentPath === '/' && token && userData) {
                console.log('🛡️ Seguridad: Redirigiendo usuario autenticado desde /');
                window.location.href = '/dashboard';
            }
            
            // REGLA DE SEGURIDAD: Si NO estamos en "/" y NO tenemos token, redirigir
            if (currentPath !== '/' && (!token || !userData)) {
                console.log('🛡️ Seguridad: Redirigiendo usuario no autenticado a /');
                sessionStorage.clear();
                window.location.href = '/';
            }
        }, 100);
    }
})();
// auth-middleware.js - VERSIÓN FINAL CORREGIDA PARA RENDER
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
        
        // 1. DETECTAR PÁGINA ACTUAL (Render abre sin barra)
        const currentUrl = window.location.href;
        const currentPath = window.location.pathname;
        const origin = window.location.origin;
        
        console.log('📍 URL completa:', currentUrl);
        console.log('📍 Pathname:', currentPath);
        console.log('📍 Origin:', origin);
        
        // ¿Estamos en la página de LOGIN? (con o sin barra)
        // IMPORTANTE: Render abre https://simona-9e42.onrender.com (sin barra)
        const isLoginPage = 
            currentPath === '/' || 
            currentPath === '' || 
            currentUrl === origin || 
            currentUrl === origin + '/';
        
        console.log('📄 ¿Es página de login?:', isLoginPage ? 'SÍ' : 'NO');
        
        const token = sessionStorage.getItem('authToken');
        const userData = sessionStorage.getItem('userData');
        
        console.log('🔑 Token en sessionStorage:', token ? 'SÍ (' + token.substring(0, 10) + '...)' : 'NO');
        console.log('👤 UserData en sessionStorage:', userData ? 'SÍ' : 'NO');
        
        // 2. SI ESTAMOS EN LOGIN PAGE
        if (isLoginPage) {
            console.log('📄 Detectado: Estamos en LOGIN PAGE');
            
            // Si YA está autenticado → REDIRIGIR a DASHBOARD
            if (token && userData) {
                console.log('🔄 Usuario YA autenticado, redirigiendo a DASHBOARD');
                window.location.href = '/dashboard';
                return false; // No permitir acceso al login
            }
            
            console.log('✅ Mostrar formulario de login (usuario no autenticado)');
            return true; // Permitir acceso al login
        }
        
        // 3. SI ESTAMOS EN CUALQUIER OTRA PÁGINA
        console.log('🏠 Detectado: Estamos en página PROTEGIDA');
        
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
        console.log('🔄 redirectToLogin() ejecutándose...');
        
        // Limpiar sesión primero
        this.clearSession();
        
        // Redirigir a la raíz (Render maneja con/sin barra)
        const rootUrl = window.location.origin;
        console.log('🔀 Redirigiendo a LOGIN:', rootUrl);
        
        // Usar location.replace para evitar que quede en el historial
        window.location.replace(rootUrl);
    }
}

// ========== INICIALIZACIÓN AUTOMÁTICA ==========
(function() {
    // Solo ejecutar en navegador
    if (typeof window !== 'undefined') {
        console.log('🔄 auth-middleware.js: Inicializando...');
        
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

// ========== FIX ESPECIAL PARA RENDER (URL sin barra) ==========
(function() {
    if (typeof window !== 'undefined') {
        setTimeout(() => {
            console.log('🔧 FIX para Render: Verificando URL...');
            
            const currentUrl = window.location.href;
            const origin = window.location.origin;
            const currentPath = window.location.pathname;
            
            // Caso 1: URL es exactamente la raíz SIN barra
            // Ejemplo: https://simona-9e42.onrender.com
            if (currentUrl === origin && currentPath === '') {
                console.log('⚠️  Detectado: Render abrió URL sin barra');
                console.log('ℹ️  Esto es normal, auth-middleware.js lo manejará');
            }
            
            // Caso 2: Redirección de emergencia si hay problemas
            const token = sessionStorage.getItem('authToken');
            const userData = sessionStorage.getItem('userData');
            
            // REGLA DE EMERGENCIA: Si tenemos token pero estamos en raíz
            if ((currentUrl === origin || currentPath === '/') && token && userData) {
                console.log('🚨 EMERGENCIA: Token encontrado en raíz, redirigiendo...');
                window.location.href = '/dashboard';
            }
            
            // REGLA DE EMERGENCIA: Si NO tenemos token pero estamos en página protegida
            const protectedPaths = ['/dashboard', '/historial', '/reportes', '/configuracion'];
            const isProtectedPath = protectedPaths.some(path => currentPath.startsWith(path));
            
            if (isProtectedPath && (!token || !userData)) {
                console.log('🚨 EMERGENCIA: No autenticado en página protegida');
                console.log('🔄 Redirigiendo a raíz...');
                window.location.replace(origin);
            }
        }, 200);
    }
})();

// Exportar para que esté disponible globalmente
if (typeof window !== 'undefined') {
    window.AuthMiddleware = AuthMiddleware;
}
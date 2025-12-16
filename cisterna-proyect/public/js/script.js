// public/script.js - VERSIÓN CORREGIDA CON AUTENTICACIÓN
// EN LA PRIMERA LÍNEA de script.js, agrega:
(function() {
    console.log('🛡️ script.js: Verificación de emergencia INICIANDO');
    
    // DETECTAR si estamos en login.html
    // Verificar por elementos ÚNICOS de login.html
    const tieneFormularioLogin = document.getElementById('loginForm') !== null;
    const tieneInputUsuario = document.getElementById('username') !== null;
    const esLoginPage = window.location.pathname === '/' || 
                       window.location.pathname === '' ||
                       window.location.href === window.location.origin ||
                       window.location.href === window.location.origin + '/';
    
    console.log('🔍 Detección login:');
    console.log('  - Formulario login:', tieneFormularioLogin ? 'SÍ' : 'NO');
    console.log('  - Input usuario:', tieneInputUsuario ? 'SÍ' : 'NO');
    console.log('  - Es ruta raíz:', esLoginPage ? 'SÍ' : 'NO');
    
    // SI es login page → NO EJECUTAR script.js
    if (tieneFormularioLogin || tieneInputUsuario || esLoginPage) {
        console.log('🚨 EMERGENCIA: script.js detectado en login page!');
        console.log('⛔ DETENIENDO EJECUCIÓN COMPLETA de script.js');
        
        // 1. Deshabilitar completamente
        window.__SCRIPT_JS_BLOQUEADO = true;
        
        // 2. Sobrescribir TODO para que no haga nada
        window.SistemaCisterna = function() {
            console.log('⛔ SistemaCisterna BLOQUEADO - login page');
            return { init: function() {} };
        };
        
        // 3. Sobrescribir DOMContentLoaded
        const originalAdd = document.addEventListener;
        document.addEventListener = function(type, listener) {
            if (type === 'DOMContentLoaded') {
                console.log('⛔ DOMContentLoaded BLOQUEADO');
                return;
            }
            return originalAdd.apply(this, arguments);
        };
        
        // 4. SALIR completamente
        // No crear clase, no hacer nada
        throw new Error('script.js bloqueado - página de login');
    }
    
    console.log('✅ script.js: Página protegida detectada, continuando...');
})();

// LUEGO el resto de tu script.js normal...

// ========== CLASE SISTEMA CISTERNA ==========
class SistemaCisterna {
    constructor() {
        // Verificar si script.js fue deshabilitado (para login)
        if (window.__scriptJsDisabled) {
            console.log('⏸️ SistemaCisterna: Constructor bloqueado (login page)');
            return;
        }
        
        // Elementos que pueden estar en cualquier página
        this.alertsList = document.getElementById('alertsList');
        this.lastRefreshElement = document.getElementById('lastRefresh');
        
        // Elementos específicos del dashboard
        this.waterElement = document.getElementById('waterLevel');
        this.percentageElement = document.getElementById('waterPercentage');
        this.lastUpdateElement = document.getElementById('lastUpdate');
        this.statusElement = document.getElementById('status');
        
        // Token de autenticación
        this.authToken = null;
        this.userData = null;
        
        this.init();
    }

    init() {
        // Verificar si script.js fue deshabilitado
        if (window.__scriptJsDisabled) {
            console.log('⏸️ SistemaCisterna.init(): Bloqueado (login page)');
            return;
        }
        
        console.log('🔐 SistemaCisterna: Verificando autenticación...');
        
        // 1. Verificar autenticación
        if (!this.checkAuthentication()) {
            console.log('❌ SistemaCisterna: Usuario no autenticado');
            return;
        }
        
        // 2. Cargar token y datos del usuario
        this.loadUserData();
        
        // 3. Configurar fetch con interceptor de token
        this.setupAuthInterceptor();
        
        // 4. Continuar con la inicialización normal
        this.continueInitialization();
    }

    checkAuthentication() {
        // Verificar si está autenticado usando el middleware
        if (typeof AuthMiddleware === 'undefined') {
            console.error('❌ AuthMiddleware no está definido');
            return false;
        }
        return AuthMiddleware.isAuthenticated();
    }

    loadUserData() {
        // Cargar datos del usuario desde sessionStorage
        this.userData = AuthMiddleware.getUser();
        this.authToken = AuthMiddleware.getToken();
        
        console.log('✅ SistemaCisterna: Usuario cargado:', this.userData?.username);
        
        // Mostrar nombre de usuario si hay elemento para ello
        this.showUserName();
    }

    showUserName() {
        // Mostrar nombre de usuario en la interfaz si existe el elemento
        const userDisplay = document.getElementById('userDisplay');
        const userName = document.getElementById('userName');
        
        if (userDisplay && this.userData?.name) {
            userDisplay.textContent = this.userData.name;
        }
        
        if (userName && this.userData?.username) {
            userName.textContent = this.userData.username;
        }
    }

    setupAuthInterceptor() {
        // Guardar referencia original de fetch
        const originalFetch = window.fetch;
        
        // Sobrescribir fetch para agregar token automáticamente
        window.fetch = async (url, options = {}) => {
            // Agregar token a las peticiones (excepto login)
            if (this.authToken && !url.includes('/auth/login')) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${this.authToken}`
                };
            }
            
            try {
                const response = await originalFetch(url, options);
                
                // Si la respuesta es 401 o 403, hacer logout
                if (response.status === 401 || response.status === 403) {
                    console.log('🔐 Token inválido o expirado, redirigiendo...');
                    AuthMiddleware.redirectToLogin();
                    return response;
                }
                
                return response;
            } catch (error) {
                console.error('❌ Error en petición:', error);
                throw error;
            }
        };
    }

    continueInitialization() {
        console.log('🚀 SistemaCisterna: Inicializando funcionalidades...');
        
        // Cargar configuración en el dashboard
        this.cargarConfiguracionEnDashboard();
        
        // Escuchar cambios en la configuración
        this.escucharCambiosConfiguracion();
        
        // Actualizar información común (alertas y timestamp)
        this.updateCommonInfo();
        
        // Si estamos en el dashboard, actualizar datos específicos
        if (this.isDashboardPage()) {
            console.log('📊 SistemaCisterna: Dashboard detectado, actualizando cada 10s');
            this.updateDashboard();
            setInterval(() => this.updateDashboard(), 10000);
        } else {
            console.log('📊 SistemaCisterna: Otra página, actualizando info común cada 10s');
            setInterval(() => this.updateCommonInfo(), 10000);
        }
        
        // Actualizar timestamp común cada minuto
        setInterval(() => this.updateLastRefresh(), 60000);
        
        // Verificar sesión periódicamente
        this.startSessionMonitor();
    }

    startSessionMonitor() {
        // Verificar sesión cada minuto
        setInterval(() => {
            if (!AuthMiddleware.isAuthenticated()) {
                console.log('⏰ Sesión expirada, redirigiendo...');
                AuthMiddleware.redirectToLogin();
            }
        }, 60000);
    }

    cargarConfiguracionEnDashboard() {
        if (!this.isDashboardPage()) return;
        
        // Cargar configuración desde localStorage
        const config = JSON.parse(localStorage.getItem('configuracionCisterna')) || {};
        
        // Mapeo de campos de configuración a elementos HTML
        const mapeoCampos = {
            'cisternaNombre': 'config-cisternaNombre',
            'cisternaCapacidad': 'config-cisternaCapacidad',
            'cisternaUbicacion': 'config-cisternaUbicacion', 
            'cisternaMaterial': 'config-cisternaMaterial',
            'sensorModelo': 'config-sensorModelo',
            'sensorID': 'config-sensorID',
            'sensorInstalacion': 'config-sensorInstalacion',
            'sensorPrecision': 'config-sensorPrecision',
            'frecuenciaMuestreo': 'config-frecuenciaMuestreo'
        };
        
        // Actualizar cada campo en el dashboard
        Object.keys(mapeoCampos).forEach(campoConfig => {
            const elementoId = mapeoCampos[campoConfig];
            const elemento = document.getElementById(elementoId);
            
            if (elemento) {
                let valor = config[campoConfig] || this.getValorPorDefecto(campoConfig);
                
                // Formatear valores especiales
                if (campoConfig === 'cisternaCapacidad') {
                    valor = `${Number(valor).toLocaleString()} litros`;
                } else if (campoConfig === 'frecuenciaMuestreo') {
                    valor = this.formatearFrecuencia(valor);
                }
                
                elemento.textContent = valor;
            }
        });
    }

    getValorPorDefecto(campo) {
        const valoresPorDefecto = {
            'cisternaNombre': 'No obtenido',
            'cisternaCapacidad': '0',
            'cisternaUbicacion': 'No obtenido',
            'cisternaMaterial': 'No obtenido',
            'sensorModelo': 'No obtenido',
            'sensorID': 'No obtenido',
            'sensorInstalacion': 'No obtenido',
            'sensorPrecision': 'No obtenido',
            'frecuenciaMuestreo': 'No obtenido'
        };
        return valoresPorDefecto[campo] || '';
    }

    formatearFrecuencia(ms) {
        if (!ms) return 'Cada 10 segundos';
        const segundos = parseInt(ms) / 1000;
        if (segundos < 60) {
            return `Cada ${segundos} segundos`;
        } else {
            const minutos = segundos / 60;
            return `Cada ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
        }
    }

    escucharCambiosConfiguracion() {
        window.addEventListener('configuracionActualizada', () => {
            this.cargarConfiguracionEnDashboard();
        });
        
        window.addEventListener('storage', (e) => {
            if (e.key === 'configuracionCisterna') {
                setTimeout(() => this.cargarConfiguracionEnDashboard(), 100);
            }
        });
    }

    isDashboardPage() {
        return this.waterElement !== null && 
               this.percentageElement !== null && 
               this.lastUpdateElement !== null;
    }

    async updateCommonInfo() {
        try {
            const response = await fetch('/api/level');
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            
            const data = await response.json();
            this.updateAlerts(data.level);
            this.updateLastRefresh();
            
        } catch (error) {
            console.error("❌ Error obteniendo datos:", error);
            this.showError();
        }
    }

    async updateDashboard() {
        try {
            const response = await fetch('/api/level');
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            
            const data = await response.json();
            this.updateDisplay(data.level);
            this.updateAlerts(data.level);
            this.updateLastRefresh();
            
        } catch (error) {
            console.error("❌ Error en dashboard:", error);
            this.showError();
        }
    }

    updateDisplay(level) {
        if (this.isDashboardPage()) {
            this.waterElement.style.height = level + '%';
            this.percentageElement.textContent = level + '%';
            this.lastUpdateElement.textContent = new Date().toLocaleTimeString();
            this.updateStatus(level);
        }
    }

    updateStatus(level) {
        if (!this.statusElement) return;
        
        let status;
        if (level >= 80) status = "Lleno";
        else if (level >= 30) status = "Normal";
        else if (level >= 15) status = "Bajo";
        else status = "Crítico";
        
        this.statusElement.textContent = status;
    }

    updateAlerts(level) {
        if (!this.alertsList) return;
        
        let alertHTML = '';
        if (level <= 15) {
            alertHTML = `<div class="alert-item danger">⚠️ Nivel crítico!</div>`;
        } else if (level <= 30) {
            alertHTML = `<div class="alert-item warning">📉 Nivel bajo</div>`;
        } else if (level >= 95) {
            alertHTML = `<div class="alert-item info">✅ Cisterna casi llena</div>`;
        } else {
            alertHTML = `<div class="alert-item info">✅ Sistema normal</div>`;
        }
        
        this.alertsList.innerHTML = alertHTML;
    }

    updateLastRefresh() {
        if (this.lastRefreshElement) {
            this.lastRefreshElement.textContent = new Date().toLocaleString();
        }
    }

    showError() {
        if (this.percentageElement) this.percentageElement.textContent = 'Error';
        if (this.statusElement) this.statusElement.textContent = 'Error';
        if (this.alertsList) {
            this.alertsList.innerHTML = `<div class="alert-item danger">❌ Error de conexión</div>`;
        }
    }
}

// ========== INICIALIZACIÓN FINAL ==========
// SOLO ejecutar si NO estamos en login page
(function() {
    // Verificar nuevamente si estamos en login (por seguridad)
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;
    const origin = window.location.origin;
    
    const isLoginPage = 
        currentPath === '/' || 
        currentPath === '' || 
        currentUrl === origin || 
        currentUrl === origin + '/';
    
    if (isLoginPage) {
        console.log('⏸️ script.js: Login page detectada - NO inicializando');
        return;
    }
    
    // Solo inicializar en páginas protegidas
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📊 script.js: DOMContentLoaded en página protegida');
        
        // Verificar que AuthMiddleware exista
        if (typeof AuthMiddleware === 'undefined') {
            console.error('❌ ERROR: AuthMiddleware no definido');
            return;
        }
        
        // Usar protectPage() para verificar autenticación
        if (AuthMiddleware.protectPage()) {
            console.log('✅ script.js: Usuario autenticado, creando SistemaCisterna');
            new SistemaCisterna();
        } else {
            console.log('⏸️ script.js: protectPage() retornó false');
        }
    });
})();
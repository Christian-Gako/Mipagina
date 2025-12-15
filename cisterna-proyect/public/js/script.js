// public/script.js - VERSIÓN CORREGIDA CON AUTENTICACIÓN
class SistemaCisterna {
    constructor() {
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
        // 1. Verificar autenticación
        if (!this.checkAuthentication()) {
            console.log('Usuario no autenticado, redirigiendo...');
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
        return AuthMiddleware.isAuthenticated();
    }

    loadUserData() {
        // Cargar datos del usuario desde sessionStorage
        this.userData = AuthMiddleware.getUser();
        this.authToken = AuthMiddleware.getToken();
        
        console.log('Usuario cargado:', this.userData?.username);
        
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
                    console.log('Token inválido o expirado, redirigiendo...');
                    AuthMiddleware.redirectToLogin();
                    return response;
                }
                
                return response;
            } catch (error) {
                console.error('Error en petición:', error);
                throw error;
            }
        };
    }

    continueInitialization() {
        // Solo ejecutar después de verificar autenticación
        
        // Cargar configuración en el dashboard
        this.cargarConfiguracionEnDashboard();
        
        // Escuchar cambios en la configuración
        this.escucharCambiosConfiguracion();
        
        // Actualizar información común (alertas y timestamp)
        this.updateCommonInfo();
        
        // Si estamos en el dashboard, actualizar datos específicos
        if (this.isDashboardPage()) {
            this.updateDashboard();
            setInterval(() => this.updateDashboard(), 10000);
        } else {
            // En otras páginas, solo actualizar cada 10 segundos
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
                console.log('Sesión expirada, redirigiendo...');
                AuthMiddleware.redirectToLogin();
            }
        }, 60000);
    }

    // El resto de tus métodos existentes se mantienen igual...
    cargarConfiguracionEnDashboard() {
        if (!this.isDashboardPage()) return;
        
        // Cargar configuración desde localStorage
        const config = JSON.parse(localStorage.getItem('configuracionCisterna')) || {};
        
        // Mapeo de campos de configuración a elementos HTML
        const mapeoCampos = {
            // Datos de la Cisterna
            'cisternaNombre': 'config-cisternaNombre',
            'cisternaCapacidad': 'config-cisternaCapacidad',
            'cisternaUbicacion': 'config-cisternaUbicacion', 
            'cisternaMaterial': 'config-cisternaMaterial',
            
            // Datos del Sensor
            'sensorModelo': 'config-sensorModelo',
            'sensorID': 'config-sensorID',
            'sensorInstalacion': 'config-sensorInstalacion',
            'sensorPrecision': 'config-sensorPrecision',
            
            // Configuración del Sistema
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
                } else if (campoConfig === 'sensorInstalacion' && valor) {
                    // Formatear fecha de instalación
                    if (valor.includes('-')) {
                        // Si es formato YYYY-MM-DD
                        const fecha = new Date(valor);
                        valor = fecha.toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                        }).replace(/ /g, ' ');
                    }
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
        // Escuchar evento personalizado desde config.js
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
            console.error("Error obteniendo datos:", error);
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
            console.error("Error en dashboard:", error);
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
        
        if (level >= 80) {
            status = "Lleno";
        } else if (level >= 30) {
            status = "Normal";
        } else if (level >= 15) {
            status = "Bajo";
        } else {
            status = "Crítico";
        }
        
        this.statusElement.textContent = status;
    }

    updateAlerts(level) {
        if (!this.alertsList) return;
        
        let alertHTML = '';
        
        if (level <= 15) {
            alertHTML = `
                <div class="alert-item danger">
                    ⚠️ Nivel crítico! Revisar suministro de agua
                </div>
            `;
        } else if (level <= 30) {
            alertHTML = `
                <div class="alert-item warning">
                    📉 Nivel bajo. Monitorear constantemente
                </div>
            `;
        } else if (level >= 95) {
            alertHTML = `
                <div class="alert-item info">
                    ✅ Cisterna casi llena
                </div>
            `;
        } else {
            alertHTML = `
                <div class="alert-item info">
                    ✅ Sistema funcionando normalmente
                </div>
            `;
        }
        
        this.alertsList.innerHTML = alertHTML;
    }

    updateLastRefresh() {
        if (this.lastRefreshElement) {
            const now = new Date();
            this.lastRefreshElement.textContent = now.toLocaleString();
        }
    }

    showError() {
        if (this.percentageElement) {
            this.percentageElement.textContent = 'Error';
        }
        if (this.statusElement) {
            this.statusElement.textContent = 'Error';
        }
        if (this.alertsList) {
            this.alertsList.innerHTML = `
                <div class="alert-item danger">
                    ❌ Error de conexión con el servidor
                </div>
            `;
        }
    }
}

// Inicialización simplificada
document.addEventListener('DOMContentLoaded', function() {
    // Solo crear la instancia si está autenticado
    if (!AuthMiddleware.protectPage()) {
        return;
    }
        
    new SistemaCisterna();
    
});
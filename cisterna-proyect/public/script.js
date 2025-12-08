// public/script.js - VERSIÓN CON CONFIGURACIÓN DINÁMICA
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
        
        this.init();
    }

    init() {
        console.log("🚀 Iniciando sistema de cisterna...");
        
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
    }

    cargarConfiguracionEnDashboard() {
        if (!this.isDashboardPage()) return;
        
        // Cargar configuración desde localStorage
        const config = JSON.parse(localStorage.getItem('configuracionCisterna')) || {};
        console.log('📋 Cargando configuración en dashboard:', config);
        
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
                        valor = fecha.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                        }).replace(/ /g, ' ');
                    }
                }
                
                elemento.textContent = valor;
                console.log(`✅ Actualizado ${campoConfig}: ${valor}`);
            }
        });
    }

    getValorPorDefecto(campo) {
        const valoresPorDefecto = {
            'cisternaNombre': 'Cisterna - Sorluana',
            'cisternaCapacidad': '10000',
            'cisternaUbicacion': 'Edificio G - Sor Juana',
            'cisternaMaterial': 'Concreto armado',
            'sensorModelo': 'Sensor Capacitivo XYZ-2000',
            'sensorID': 'CAP-SENS-001',
            'sensorInstalacion': '15/Oct/2024',
            'sensorPrecision': '±2%',
            'frecuenciaMuestreo': '10000'
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
            console.log('🔄 Configuración actualizada, recargando dashboard...');
            this.cargarConfiguracionEnDashboard();
        });
        
        // Escuchar cambios en localStorage (para otras pestañas)
        window.addEventListener('storage', (e) => {
            if (e.key === 'configuracionCisterna') {
                console.log('🔄 Configuración cambiada en otra pestaña, actualizando...');
                setTimeout(() => this.cargarConfiguracionEnDashboard(), 100);
            }
        });
    }

    isDashboardPage() {
        // Verificar si estamos en la página del dashboard
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

// Inicializar el sistema cuando la página cargue
document.addEventListener('DOMContentLoaded', function() {
    new SistemaCisterna();
});
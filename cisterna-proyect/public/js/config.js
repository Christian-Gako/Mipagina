// public/config.js

// Validar sesión al cargar la página
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Primero validar sesión
    if (!AuthMiddleware.protectPage()) {
        return; // Si no está autenticado, se redirigió al login
    }
    
    // 2. Si está autenticado, cargar datos del usuario
    //const user = AuthMiddleware.getUser();
    new ConfiguracionManager();

});

class ConfiguracionManager {
    constructor() {
        this.form = document.getElementById('configForm');
        this.resetBtn = document.getElementById('resetBtn');
        this.testBtn = document.getElementById('testBtn');
        this.messageContainer = document.getElementById('messageContainer');
        this.statusMessage = document.getElementById('statusMessage');
        
        this.init();
    }

    init() {
        this.cargarConfiguracion();
        
        this.form.addEventListener('submit', (e) => this.guardarConfiguracion(e));
        this.resetBtn.addEventListener('click', () => this.restablecerValores());
        this.testBtn.addEventListener('click', () => this.probarConexion());
    }


    llenarFormulario(config) {
        const campos = [
            'cisternaNombre', 'cisternaCapacidad', 'cisternaUbicacion', 'cisternaMaterial',
            'sensorModelo', 'sensorID', 'sensorInstalacion', 'sensorPrecision', 
            'frecuenciaMuestreo', 'umbralAlerta', 'umbralCritico'
        ];
        
        campos.forEach(campo => {
            const elemento = document.getElementById(campo);
            if (elemento && config[campo] !== undefined) {
                if (campo === 'sensorInstalacion' && config[campo]) {
                    const fecha = new Date(config[campo]);
                    elemento.value = fecha.toISOString().split('T')[0];
                } else {
                    elemento.value = config[campo];
                }
            }
        });
    }
    async cargarConfiguracion() {
        try {
            const response = await fetch('/api/configuracion');
            if (!response.ok) throw new Error('Error del servidor');
            
            const config = await response.json();
            this.llenarFormulario(config);
            
        } catch (error) {
            throw new Error('No se pudo cargar configuración');
        }
    }

      async guardarConfiguracion(event) {
        event.preventDefault();
        
        const formData = new FormData(this.form);
        const configuracion = {};
        let necesitaReinicio = false;
        
        // Procesar datos del formulario
        for (let [key, value] of formData.entries()) {
            if (['cisternaCapacidad', 'frecuenciaMuestreo', 'umbralAlerta', 'umbralCritico'].includes(key)) {
                configuracion[key] = parseInt(value);
            } else {
                configuracion[key] = value;
            }
        }
        
        // Verificar si cambió la frecuencia de muestreo
        const configAnterior = JSON.parse(localStorage.getItem('configuracionCisterna') || '{}');
        if (configuracion.frecuenciaMuestreo !== configAnterior.frecuenciaMuestreo) {
            necesitaReinicio = true;
        }
        
        try {
            this.mostrarMensaje('Guardando configuración...', 'info');
            
            // PASO 1: GUARDAR EN MONGODB (ESPERAR CONFIRMACIÓN)
            const response = await fetch('/api/configuracion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configuracion)
            });
            
            const resultado = await response.json();
            
            if (!resultado.success) {
                throw new Error(resultado.error || 'Error desconocido al guardar');
            }
            
            // PASO 2: GUARDAR LOCALMENTE
            localStorage.setItem('configuracionCisterna', JSON.stringify(configuracion));
            this.notificarCambioConfiguracion();
            
            // PASO 3: VERIFICAR Y REINICIAR SI ES NECESARIO
            if (necesitaReinicio) {
                this.mostrarMensaje('Configuración guardada. Reiniciando servidor...', 'info');
                
                // Esperar 3 segundos para asegurar que todo se procesó
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // PASO 4: REINICIAR SERVIDOR
                await this.reiniciarServidor();
            } else {
                this.mostrarMensaje('configuración guardada correctamente', 'info');
            }
            
        } catch (error) {
            console.error(' Error en el proceso de guardado:', error);
            
            // FALLBACK: Guardar solo localmente
            localStorage.setItem('configuracionCisterna', JSON.stringify(configuracion));
            this.notificarCambioConfiguracion();
            
            if (necesitaReinicio) {
                this.mostrarMensaje('Configuración guardada localmente. Reinicia el servidor manualmente.', 'warning');
            }
        }
    }

    async reiniciarServidor() {
        try {
            this.mostrarMensaje('Reiniciando servidor, por favor espera...', 'warning');
            
            const response = await fetch('/api/servidor/reiniciar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const resultado = await response.json();
            
            if (resultado.success) {
                this.mostrarMensaje('✅ ' + resultado.message, 'info');
                
                // Recargar la página después de un delay
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
                
            } else {
                throw new Error(resultado.error || 'Error desconocido al reiniciar');
            }
            
        } catch (error) {
            this.mostrarMensaje('Error al reiniciar. Reinicia manualmente.', 'danger');
        }
    }

    notificarCambioConfiguracion() {
        const evento = new Event('configuracionActualizada');
        window.dispatchEvent(evento);
        localStorage.setItem('configuracionActualizada', Date.now().toString());
    }

    restablecerValores() {
        if (confirm('¿Estás seguro de que quieres restablecer todos los valores a los predeterminados?')) {
            localStorage.removeItem('configuracionCisterna');
            this.form.reset();
            this.mostrarMensaje('🔄 Valores restablecidos a predeterminados', 'info');
        }
    }

    
async probarConexion() {
    this.mostrarMensaje('🔌 Probando conexión con el servidor...', 'info');
    
    try {
        
        const response = await fetch('/test', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 segundos timeout
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Mostrar resultado según respuesta
        if (data.mongodb === 'Conectado') {
            this.mostrarMensaje(`${data.message} | MongoDB: ${data.mongodb}`, 'success');
        } else {
            this.mostrarMensaje(`${data.message} | MongoDB: ${data.mongodb}`, 'warning');
        }
        
    } catch (error) {
        
        // Mensajes específicos según error
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            this.mostrarMensaje('Tiempo de espera agotado. El servidor no responde.', 'error');
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            this.mostrarMensaje('Error de red. Verifica tu conexión a internet.', 'error');
        } else {
            this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
        }
    }
}

    mostrarMensaje(mensaje, tipo = 'info') {
        this.statusMessage.textContent = mensaje;
        this.statusMessage.className = `alert-item ${tipo}`;
        this.messageContainer.style.display = 'block';
        
        // Mantener mensajes de error por más tiempo
        const tiempo = tipo === 'danger' ? 8000 : 5000;
        setTimeout(() => {
            this.messageContainer.style.display = 'none';
        }, tiempo);
    }
}


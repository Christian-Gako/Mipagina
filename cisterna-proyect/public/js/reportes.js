// reportes.js - Sistema Completo de Reportes
class ReportesManager {
    constructor() {
        if (!this.validarSesion()) return;
        
        this.authToken = AuthMiddleware.getToken();
        this.currentReportType = null;
        this.currentReportData = null;
        this.selectedTemplate = 'standard'; // Plantilla por defecto
        
        this.setupElements();
        this.setupEventListeners();
        this.setupAuthInterceptor();
        this.cargarDatosConfiguracion();
    }

    // ========== INICIALIZACIÓN ==========
    validarSesion() {
        if (typeof AuthMiddleware === 'undefined') {
            console.error('AuthMiddleware no está cargado');
            return false;
        }
        return AuthMiddleware.protectPage();
    }

    setupElements() {
        // Elementos principales
        this.reportCards = document.querySelectorAll('.report-card');
        this.reportConfig = document.getElementById('reportConfig');
        this.reportPreview = document.getElementById('reportPreview');
        this.filtersContainer = document.getElementById('filtersContainer');
        this.reportPaper = document.getElementById('reportPaper');
        this.templateSelection = document.getElementById('templateSelection');
        
        // Botones principales
        this.generateReportBtn = document.getElementById('generateReport');
        this.previewReportBtn = document.getElementById('previewReport');
        this.cancelConfigBtn = document.getElementById('cancelConfig');
        this.downloadPDFBtn = document.getElementById('downloadPDF');
        this.printPreviewBtn = document.getElementById('printPreview');
        this.editConfigBtn = document.getElementById('editConfig');
        this.finalizeReportBtn = document.getElementById('finalizeReport');
        this.closePreviewBtn = document.getElementById('closePreview');
        
        // Template cards
        this.templateCards = document.querySelectorAll('.template-card');
        
        // Ocultar sección de plantillas desde el inicio
        if (this.templateSelection) {
            this.templateSelection.style.display = 'none';
        }
    }

    setupEventListeners() {
        // Selección de tipo de reporte
        this.reportCards.forEach(card => {
            card.addEventListener('click', () => {
                const reportType = card.getAttribute('data-report');
                this.seleccionarTipoReporte(reportType);
            });
        });

        // Botones de configuración
        this.generateReportBtn.addEventListener('click', () => this.generarReporte());
        this.previewReportBtn.addEventListener('click', () => this.generarVistaPrevia());
        this.cancelConfigBtn.addEventListener('click', () => this.cancelarConfiguracion());

        // Botones de vista previa
        if (this.downloadPDFBtn) this.downloadPDFBtn.addEventListener('click', () => this.exportarPDF());
        if (this.printPreviewBtn) this.printPreviewBtn.addEventListener('click', () => this.imprimirReporte());
        if (this.editConfigBtn) this.editConfigBtn.addEventListener('click', () => this.editarConfiguracion());
        if (this.finalizeReportBtn) this.finalizeReportBtn.addEventListener('click', () => this.finalizarReporte());
        if (this.closePreviewBtn) this.closePreviewBtn.addEventListener('click', () => this.cerrarVistaPrevia());

        // Eventos del sistema
        window.addEventListener('configuracionActualizada', () => {
            this.cargarDatosConfiguracion();
        });
    }

    setupAuthInterceptor() {
        const originalFetch = window.fetch;
        const authToken = this.authToken;

        window.fetch = async (url, options = {}) => {
            if (authToken && !url.includes('/auth/') && !url.includes('login')) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                };
            }

            try {
                const response = await originalFetch(url, options);
                if (response.status === 401 || response.status === 403) {
                    AuthMiddleware.redirectToLogin();
                }
                return response;
            } catch (error) {
                console.error('Error en la petición:', error);
                throw error;
            }
        };
    }

    cargarDatosConfiguracion() {
        const config = JSON.parse(localStorage.getItem('configuracionCisterna')) || {};
        this.configuracion = config;
    }

    // ========== GESTIÓN DE REPORTES ==========
    seleccionarTipoReporte(tipo) {
        this.currentReportType = tipo;
        
        // Actualizar selección visual
        this.reportCards.forEach(card => card.classList.remove('selected'));
        document.querySelector(`.report-card[data-report="${tipo}"]`).classList.add('selected');
        
        // Mostrar configuración
        this.reportConfig.style.display = 'block';
        this.reportPreview.style.display = 'none';
        
        // Generar filtros
        this.generarFiltros(tipo);
    }
    

    generarFiltros(tipo) {
        let filtrosHTML = '';
        
        const hoy = new Date();
        const fechaHoy = hoy.toISOString().split('T')[0];
        
        switch(tipo) {
            case 'daily':
                filtrosHTML = `
                    <div class="filter-group">
                        <label for="fechaReporte"><i class="fas fa-calendar"></i> Fecha:</label>
                        <input type="date" id="fechaReporte" class="form-control" value="${fechaHoy}">
                    </div>
                `;
                break;
                
            case 'weekly':
                filtrosHTML = `
                    <div class="filter-group">
                        <label for="semanaReporte"><i class="fas fa-calendar-week"></i> Semana:</label>
                        <input type="week" id="semanaReporte" class="form-control" value="${this.getCurrentWeek()}">
                    </div>
                `;
                break;
                
            case 'monthly':
                const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
                filtrosHTML = `
                    <div class="filter-group">
                        <label for="mesReporte"><i class="fas fa-calendar-alt"></i> Mes:</label>
                        <input type="month" id="mesReporte" class="form-control" value="${mesActual}">
                    </div>
                `;
                break;
                
            case 'custom':
                const fechaManana = new Date(hoy);
                fechaManana.setDate(fechaManana.getDate() + 1);
                const fechaMananaStr = fechaManana.toISOString().split('T')[0];
                
                filtrosHTML = `
                    <div class="filter-group">
                        <label for="fechaInicio"><i class="fas fa-calendar"></i> Fecha inicio:</label>
                        <input type="date" id="fechaInicio" class="form-control" value="${fechaHoy}">
                    </div>
                    <div class="filter-group">
                        <label for="fechaFin"><i class="fas fa-calendar"></i> Fecha fin:</label>
                        <input type="date" id="fechaFin" class="form-control" value="${fechaMananaStr}">
                    </div>
                `;
                break;
        }
        
        this.filtersContainer.innerHTML = filtrosHTML;
    }

    getCurrentWeek() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const pastDaysOfYear = (now - startOfYear) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    }

    // ========== GENERACIÓN DE REPORTE ==========
    async generarReporte() {
        try {
            this.mostrarMensaje('Generando reporte...', 'info');
            
            const parametros = this.obtenerParametros();
            if (!this.validarParametros(parametros)) return;
            
            // Obtener datos
            const datos = await this.obtenerDatosReporte(parametros);
            
            // Procesar datos
            this.currentReportData = {
                estadisticas: this.calcularEstadisticas(datos),
                datos: datos,
                parametros: parametros,
                timestamp: new Date().toISOString()
            };
            
            // Mostrar vista previa
            this.mostrarVistaPrevia();
            this.mostrarMensaje('Reporte generado exitosamente', 'success');
            
        } catch (error) {
            console.error('Error generando reporte:', error);
            this.mostrarMensaje(`Error: ${error.message}`, 'danger');
        }
    }

    async generarVistaPrevia() {
        try {
            this.mostrarMensaje('Generando vista previa...', 'info');
            
            const parametros = this.obtenerParametros();
            if (!this.validarParametros(parametros)) return;
            
            // Obtener datos
            const datos = await this.obtenerDatosReporte(parametros);
            
            // Procesar datos
            this.currentReportData = {
                estadisticas: this.calcularEstadisticas(datos),
                datos: datos,
                parametros: parametros,
                timestamp: new Date().toISOString()
            };
            
            // Mostrar vista previa
            this.mostrarVistaPrevia();
            this.mostrarMensaje('Vista previa generada', 'success');
            
        } catch (error) {
            console.error('Error generando vista previa:', error);
            this.mostrarMensaje(`Error: ${error.message}`, 'danger');
        }
    }

    obtenerParametros() {
        const tipo = this.currentReportType;
        let parametros = { tipo };
        
        switch(tipo) {
            case 'daily':
                const fechaInput = document.getElementById('fechaReporte');
                if (fechaInput) parametros.fecha = fechaInput.value;
                break;
                
            case 'weekly':
                const semanaInput = document.getElementById('semanaReporte');
                if (semanaInput) parametros.semana = semanaInput.value;
                break;
                
            case 'monthly':
                const mesInput = document.getElementById('mesReporte');
                if (mesInput) parametros.mes = mesInput.value;
                break;
                
            case 'custom':
                const inicioInput = document.getElementById('fechaInicio');
                const finInput = document.getElementById('fechaFin');
                if (inicioInput) parametros.inicio = inicioInput.value;
                if (finInput) parametros.fin = finInput.value;
                break;
        }
        
        return parametros;
    }

    validarParametros(parametros) {
        if (!parametros.tipo) {
            this.mostrarMensaje('Selecciona un tipo de reporte', 'warning');
            return false;
        }
        
        if (parametros.tipo === 'custom') {
            if (!parametros.inicio || !parametros.fin) {
                this.mostrarMensaje('Completa ambas fechas', 'warning');
                return false;
            }
            if (new Date(parametros.inicio) >= new Date(parametros.fin)) {
                this.mostrarMensaje('La fecha inicio debe ser anterior a la fecha fin', 'warning');
                return false;
            }
        }
        
        return true;
    }
    
    async obtenerDatosReporte(parametros) {
        if (!parametros) {
            throw new Error('Parámetros no definidos');
        }
        
        try {
            let url = '/api/reportes';
            const queryParams = new URLSearchParams();
            queryParams.append('tipo', parametros.tipo);
            
            // Construir URL según tipo de reporte
            switch(parametros.tipo) {
                case 'daily':
                    if (parametros.fecha) queryParams.append('fecha', parametros.fecha);
                    break;
                case 'weekly':
                    if (parametros.semana) queryParams.append('semana', parametros.semana);
                    break;
                case 'monthly':
                    if (parametros.mes) queryParams.append('mes', parametros.mes);
                    break;
                case 'custom':
                    if (parametros.inicio) queryParams.append('inicio', parametros.inicio);
                    if (parametros.fin) queryParams.append('fin', parametros.fin);
                    break;
            }
            
            url += `?${queryParams.toString()}`;
            
            const response = await fetch(url, {
                headers: { 
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            
            const datos = await response.json();
            
            // Transformar datos a formato esperado
            return this.transformarDatos(datos);
            
        } catch (error) {
            this.mostrarMensaje('Error obteniendo datos de la base de datos', 'danger');
            throw error;
        }
    }

    transformarDatos(datosAPI) {
        // Transformar de tu formato MongoDB a formato esperado por el sistema
        if (!Array.isArray(datosAPI)) {
            return [];
        }
        
        return datosAPI.map(item => {
            // Extraer la fecha del formato MongoDB
            const timestamp = item.timestamp?.$date || item.timestamp;
            
            return {
                timestamp: timestamp,
                level: item.value || 0,  // "value" en tu DB es el nivel
                nivel: item.value || 0,   // También como "nivel" para compatibilidad
                volumen: item.volumen || 0,
                estado: item.estado || 'Normal',
                ubicacion: item.ubicacion || 'Cisterna Desconocida',
                sensor: item.sensor || 'No se pudo obtener'
            };
        });
    }

    calcularEstadisticas(datos) {
        if (!datos || datos.length === 0) {
            return {
                promedio: 0,
                minimo: 0,
                maximo: 0,
                consumo: 0,
                totalRegistros: 0,
                volumenPromedio: 0,
                volumenMinimo: 0,
                volumenMaximo: 0
            };
        }
        
        // Usar "value" de tu DB como nivel
        const niveles = datos.map(d => d.value || d.level || 0);
        const volumenes = datos.map(d => d.volumen || 0);
        
        const promedio = niveles.reduce((a, b) => a + b, 0) / niveles.length;
        const minimo = Math.min(...niveles);
        const maximo = Math.max(...niveles);
        
        const capacidad = this.configuracion?.cisternaCapacidad || 10000;
        const consumo = ((maximo - minimo) / 100) * capacidad;
        
        // Calcular estadísticas de volumen
        const volumenPromedio = volumenes.reduce((a, b) => a + b, 0) / volumenes.length;
        const volumenMinimo = Math.min(...volumenes);
        const volumenMaximo = Math.max(...volumenes);
        
        return {
            promedio: Math.round(promedio * 10) / 10,
            minimo: Math.round(minimo * 10) / 10,
            maximo: Math.round(maximo * 10) / 10,
            consumo: Math.round(consumo),
            totalRegistros: datos.length,
            volumenPromedio: Math.round(volumenPromedio),
            volumenMinimo: Math.round(volumenMinimo),
            volumenMaximo: Math.round(volumenMaximo)
        };
    }

    // ========== VISTA PREVIA ==========
    mostrarVistaPrevia() {
        if (!this.reportPreview || !this.reportPaper || !this.currentReportData) {
            return;
        }
        
        this.reportConfig.style.display = 'none';
        this.reportPreview.style.display = 'block';
        
        // Siempre usar plantilla básica
        const contenidoHTML = this.generarPlantillaBasica();
        this.reportPaper.innerHTML = contenidoHTML;
    }

    generarPlantillaBasica() {
        const { estadisticas, datos, parametros } = this.currentReportData;
        const config = this.configuracion;
        const fechaGen = new Date().toLocaleString('es-MX');
        const capacidad = config?.cisternaCapacidad || 10000;
        
        // Obtener el nombre CORRECTO del reporte
        const nombreReporte = this.getNombreReporte(parametros.tipo);
        const periodo = this.formatearRangoFechas(parametros);
        
        // Información del sensor (del primer dato)
        const sensorInfo = datos && datos.length > 0 ? {
            sensor: datos[0].sensor || 'No identificado',
            ubicacion: datos[0].ubicacion || 'No especificada'
        } : {
            sensor: 'Sin datos',
            ubicacion: 'No especificada'
        };
        
        return `
            <div class="report-content">
                <div class="report-header">
                    <h1>Reporte de Monitoreo</h1>
                    <div class="report-subtitle">${nombreReporte} - TESCHA</div>
                </div>
                
                <div class="report-info">
                    <div class="info-row">
                        <span class="info-label">Tipo:</span>
                        <span class="info-value">${nombreReporte}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Período:</span>
                        <span class="info-value">${periodo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Generado:</span>
                        <span class="info-value">${fechaGen}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Usuario:</span>
                        <span class="info-value">${localStorage.getItem('userName') || 'Sistema'}</span>
                    </div>
                </div>
                
                <div class="report-section">
                    <h2>Información del Sistema</h2>
                    <div class="sistema-info">
                        <div class="info-item">
                            <span>Sensor:</span>
                            <strong>${sensorInfo.sensor}</strong>
                        </div>
                        <div class="info-item">
                            <span>Ubicación:</span>
                            <strong>${sensorInfo.ubicacion}</strong>
                        </div>
                        <div class="info-item">
                            <span>Capacidad:</span>
                            <strong>${capacidad.toLocaleString()} L</strong>
                        </div>
                    </div>
                </div>
                
                <div class="report-section">
                    <h2>Resumen de Datos</h2>
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-value">${estadisticas.promedio}%</div>
                            <div class="stat-label">Nivel Promedio</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${estadisticas.minimo}%</div>
                            <div class="stat-label">Nivel Mínimo</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${estadisticas.maximo}%</div>
                            <div class="stat-label">Nivel Máximo</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${estadisticas.consumo.toLocaleString()} L</div>
                            <div class="stat-label">Consumo</div>
                        </div>
                    </div>
                    
                    <div class="stats-details">
                        <div class="detail-item">
                            <span>Registros analizados:</span>
                            <strong>${estadisticas.totalRegistros}</strong>
                        </div>
                        <div class="detail-item">
                            <span>Volumen promedio:</span>
                            <strong>${estadisticas.volumenPromedio.toLocaleString()} L</strong>
                        </div>
                    </div>
                </div>
                
                <div class="report-section">
                    <h2>Estado del Sistema</h2>
                    <div class="status-summary">
                        ${this.generarResumenEstado(estadisticas)}
                    </div>
                </div>
                
                <div class="report-footer">
                    <p>Sistema de Monitoreo TESCHA - Documento generado automáticamente</p>
                </div>
            </div>
        `;
    }

    // ========== FUNCIONES AUXILIARES ==========
    getNombreReporte(tipo) {
        const nombres = {
            'daily': 'Diario',
            'weekly': 'Semanal', 
            'monthly': 'Mensual',
            'custom': 'Personalizado'
        };
        return nombres[tipo] || 'General';
    }

    formatearRangoFechas(parametros) {
        if (!parametros || !parametros.tipo) return 'Fecha no especificada';
        
        try {
            switch(parametros.tipo) {
                case 'daily':
                    if (!parametros.fecha) return 'Fecha no especificada';
                    const fecha = new Date(parametros.fecha);
                    return fecha.toLocaleDateString('es-MX', { 
                        weekday: 'long',
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    
                case 'weekly':
                    if (!parametros.semana) return 'Semana no especificada';
                    const [year, week] = parametros.semana.split('-W');
                    const fechaInicio = new Date(year, 0, 1 + (week - 1) * 7);
                    const fechaFin = new Date(fechaInicio);
                    fechaFin.setDate(fechaFin.getDate() + 6);
                    return `Semana del ${fechaInicio.getDate()} al ${fechaFin.getDate()} de ${fechaInicio.toLocaleDateString('es-MX', {month: 'long'})} ${year}`;
                    
                case 'monthly':
                    if (!parametros.mes) return 'Mes no especificado';
                    const [y, m] = parametros.mes.split('-');
                    const fechaMes = new Date(y, m - 1);
                    return fechaMes.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
                    
                case 'custom':
                    if (!parametros.inicio || !parametros.fin) return 'Rango no especificado';
                    const inicio = new Date(parametros.inicio);
                    const fin = new Date(parametros.fin);
                    return `Del ${inicio.toLocaleDateString('es-MX')} al ${fin.toLocaleDateString('es-MX')}`;
                    
                default:
                    return new Date().toLocaleDateString('es-MX');
            }
        } catch (e) {
            return new Date().toLocaleDateString('es-MX');
        }
    }

    generarResumenEstado(estadisticas) {
        if (estadisticas.minimo <= 15) {
            return `
                <div class="status-critical">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>ATENCIÓN:</strong> Nivel crítico detectado (mínimo: ${estadisticas.minimo}%)
                </div>
            `;
        } else if (estadisticas.minimo <= 30) {
            return `
                <div class="status-warning">
                    <i class="fas fa-exclamation-circle"></i>
                    <strong>ALERTA:</strong> Nivel bajo (mínimo: ${estadisticas.minimo}%)
                </div>
            `;
        } else {
            return `
                <div class="status-normal">
                    <i class="fas fa-check-circle"></i>
                    <strong>NORMAL:</strong> Sistema operando correctamente
                </div>
            `;
        }
    }

    // Modificar exportarPDF para usar datos reales
    exportarPDF() {
        try {
            this.mostrarMensaje('Generando PDF...', 'info');
            
            if (typeof window.jspdf === 'undefined') {
                throw new Error('jsPDF no está cargado');
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            let y = 20;
            
            // Título con tipo de reporte CORRECTO
            const nombreReporte = this.currentReportData ? 
                this.getNombreReporte(this.currentReportData.parametros.tipo) : 'General';
            
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(`REPORTE ${nombreReporte.toUpperCase()}`, 105, y, { align: "center" });
            y += 10;
            
            doc.setFontSize(12);
            doc.text("Sistema de Cisterna - TESCHA", 105, y, { align: "center" });
            y += 15;
            
            // Información básica
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            const hoy = new Date();
            
            // Columna izquierda
            doc.text(`Fecha: ${hoy.toLocaleDateString('es-MX')}`, 20, y);
            doc.text(`Hora: ${hoy.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}`, 20, y + 6);
            doc.text(`Usuario: ${localStorage.getItem('userName') || 'Sistema'}`, 20, y + 12);
            
            // Columna derecha - PERÍODO CORRECTO
            if (this.currentReportData?.parametros) {
                const periodo = this.formatearRangoFechas(this.currentReportData.parametros);
                doc.text(`Período: ${periodo}`, 150, y, { align: "right" });
                doc.text(`Tipo: ${nombreReporte}`, 150, y + 6, { align: "right" });
            }
            
            y += 25;
            
            // Estadísticas
            if (this.currentReportData?.estadisticas) {
                const s = this.currentReportData.estadisticas;
                
                doc.setFont(undefined, 'bold');
                doc.text("RESUMEN DE DATOS", 20, y);
                y += 10;
                
                doc.setFont(undefined, 'normal');
                const datos = [
                    `Nivel promedio: ${s.promedio}%`,
                    `Nivel mínimo: ${s.minimo}%`,
                    `Nivel máximo: ${s.maximo}%`,
                    `Consumo estimado: ${s.consumo.toLocaleString()} L`,
                    `Registros analizados: ${s.totalRegistros}`,
                    `Volumen promedio: ${s.volumenPromedio.toLocaleString()} L`
                ];
                
                datos.forEach(line => {
                    doc.text(line, 25, y);
                    y += 7;
                });
            }
            
            // Guardar con nombre específico
            const fechaStr = hoy.toISOString().split('T')[0];
            const nombreArchivo = `reporte_${nombreReporte.toLowerCase()}_${fechaStr}.pdf`;
            doc.save(nombreArchivo);
            
            this.mostrarMensaje('PDF generado', 'success');
            
        } catch (error) {
            this.mostrarMensaje(`Error: ${error.message}`, 'danger');
        }
    }

    // ========== ACCIONES DEL REPORTE ==========
    cancelarConfiguracion() {
        this.reportConfig.style.display = 'none';
        this.reportCards.forEach(card => card.classList.remove('selected'));
        this.currentReportType = null;
    }

    editarConfiguracion() {
        this.reportPreview.style.display = 'none';
        this.reportConfig.style.display = 'block';
    }

    cerrarVistaPrevia() {
        this.reportPreview.style.display = 'none';
        this.reportConfig.style.display = 'block';
    }

    finalizarReporte() {
        this.guardarEnHistorial();
        this.mostrarMensaje('Reporte guardado', 'success');
        this.cerrarVistaPrevia();
        this.reportCards.forEach(card => card.classList.remove('selected'));
        this.currentReportType = null;
        this.currentReportData = null;
    }

    guardarEnHistorial() {
        if (!this.currentReportData) return;
        
        const historial = JSON.parse(localStorage.getItem('reportesHistorial') || '[]');
        const reporteGuardado = {
            ...this.currentReportData,
            id: Date.now().toString(),
            fechaGuardado: new Date().toISOString(),
            nombre: `Reporte ${this.getNombreReporte(this.currentReportData.parametros.tipo)}`
        };
        
        historial.unshift(reporteGuardado);
        if (historial.length > 20) historial.pop();
        
        localStorage.setItem('reportesHistorial', JSON.stringify(historial));
    }

    imprimirReporte() {
        window.print();
    }

    // ========== SISTEMA DE MENSAJES ==========
    mostrarMensaje(mensaje, tipo = 'info') {
        let contenedor = document.getElementById('messageContainer');
        if (!contenedor) {
            contenedor = this.crearContenedorMensajes();
        }
        
        const iconos = {
            'success': 'fa-check-circle',
            'warning': 'fa-exclamation-triangle',
            'danger': 'fa-times-circle',
            'info': 'fa-info-circle'
        };
        
        const mensajeDiv = document.createElement('div');
        mensajeDiv.className = `message ${tipo}`;
        mensajeDiv.style.cssText = `
            background: ${tipo === 'success' ? '#d4edda' : 
                        tipo === 'warning' ? '#fff3cd' : 
                        tipo === 'danger' ? '#f8d7da' : '#d1ecf1'};
            color: ${tipo === 'success' ? '#155724' : 
                    tipo === 'warning' ? '#856404' : 
                    tipo === 'danger' ? '#721c24' : '#0c5460'};
            padding: 12px 16px;
            margin-bottom: 8px;
            border-radius: 6px;
            border-left: 4px solid ${tipo === 'success' ? '#28a745' : 
                                tipo === 'warning' ? '#ffc107' : 
                                tipo === 'danger' ? '#dc3545' : '#17a2b8'};
            font-size: 0.9em;
        `;
        
        mensajeDiv.innerHTML = `<i class="fas ${iconos[tipo] || 'fa-info-circle'}"></i> ${mensaje}`;
        contenedor.appendChild(mensajeDiv);
        
        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            if (mensajeDiv.parentNode) {
                mensajeDiv.style.opacity = '0';
                mensajeDiv.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    if (mensajeDiv.parentNode) {
                        mensajeDiv.parentNode.removeChild(mensajeDiv);
                    }
                }, 300);
            }
        }, 5000);
    }

    crearContenedorMensajes() {
        const contenedor = document.createElement('div');
        contenedor.id = 'messageContainer';
        contenedor.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
        `;
        document.body.appendChild(contenedor);
        return contenedor;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new ReportesManager();
});
// reportes.js - Sistema Completo de Reportes
class ReportesManager {
    constructor() {
        // Validar sesión
        if (!this.validarSesion()) {
            return;
        }
        
        // Inicializar propiedades
        this.userData = AuthMiddleware.getUser();
        this.authToken = AuthMiddleware.getToken();
        this.currentReportType = null;
        this.currentReportData = null;
        this.chart = null;
        
        // Configurar elementos
        this.setupElements();
        this.setupEventListeners();
        this.setupAuthInterceptor();
        this.init();
    }

    validarSesion() {
        // Verificar si está autenticado usando el middleware
        if (typeof AuthMiddleware === 'undefined') {
            console.error('AuthMiddleware no está cargado');
            return false;
        }
        
        if (!AuthMiddleware.protectPage()) {
            return false;
        }
        
        return true;
    }

    setupElements() {
        // Elementos principales
        this.reportCards = document.querySelectorAll('.report-card');
        this.reportConfig = document.getElementById('reportConfig');
        this.reportResults = document.getElementById('reportResults');
        this.filtersContainer = document.getElementById('filtersContainer');
        
        // Botones
        this.generateReportBtn = document.getElementById('generateReport');
        this.cancelConfigBtn = document.getElementById('cancelConfig');
        this.printReportBtn = document.getElementById('printReport');
        this.exportPDFBtn = document.getElementById('exportPDF');
        this.exportCSVBtn = document.getElementById('exportCSV');
        this.newReportBtn = document.getElementById('newReport');
        this.logoutBtn = document.getElementById('logoutBtn');
        
        // Elementos de resultados
        this.avgLevelElement = document.getElementById('avgLevel');
        this.minLevelElement = document.getElementById('minLevel');
        this.maxLevelElement = document.getElementById('maxLevel');
        this.consumptionElement = document.getElementById('consumption');
        this.reportTitleElement = document.getElementById('reportTitle');
        this.reportDateRangeElement = document.getElementById('reportDateRange');
        this.reportTableBody = document.getElementById('reportTableBody');
        this.chartCanvas = document.getElementById('reportChart');
        
        // Mensajes y alertas
        this.messageContainer = document.getElementById('messageContainer');
        this.statusMessage = document.getElementById('statusMessage');
        this.alertsList = document.getElementById('alertsList');
        this.lastRefreshElement = document.getElementById('lastRefresh');
        this.userNameElement = document.getElementById('userName');
        this.userDisplayElement = document.getElementById('userDisplay');
        
        // Fecha del footer
        this.footerDateElement = document.getElementById('footerDate');
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
        this.cancelConfigBtn.addEventListener('click', () => this.cancelarConfiguracion());

        // Botones de resultados
        this.printReportBtn.addEventListener('click', () => this.imprimirReporte());
        this.exportPDFBtn.addEventListener('click', () => this.exportarPDF());
        this.exportCSVBtn.addEventListener('click', () => this.exportarCSV());
        this.newReportBtn.addEventListener('click', () => this.nuevoReporte());
        
        // Logout
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => AuthMiddleware.logout());
        }

        // Eventos del sistema
        window.addEventListener('configuracionActualizada', () => {
            this.cargarDatosConfiguracion();
        });
    }

    setupAuthInterceptor() {
        const originalFetch = window.fetch;
        const authToken = this.authToken;

        window.fetch = async (url, options = {}) => {
            // Agregar token a las peticiones (excepto login y auth)
            if (authToken && !url.includes('/auth/') && !url.includes('login')) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                };
            }

            try {
                const response = await originalFetch(url, options);

                // Si la respuesta es 401 o 403, hacer logout
                if (response.status === 401 || response.status === 403) {
                    console.warn('Sesión expirada, redirigiendo al login...');
                    AuthMiddleware.redirectToLogin();
                    return response;
                }

                return response;
            } catch (error) {
                console.error('Error en la petición:', error);
                throw error;
            }
        };
    }

    init() {
        // Mostrar información del usuario
        this.mostrarInfoUsuario();
        
        // Cargar datos de configuración
        this.cargarDatosConfiguracion();
        
        // Actualizar fecha del footer
        this.actualizarFechaFooter();
        
        // Inicializar actualizaciones automáticas
        this.iniciarActualizaciones();
        
        console.log('ReportesManager inicializado correctamente');
    }

    mostrarInfoUsuario() {
        if (this.userData) {
            if (this.userNameElement) {
                this.userNameElement.textContent = this.userData.name || this.userData.username || 'Usuario';
            }
            if (this.userDisplayElement && this.userData.name) {
                this.userDisplayElement.querySelector('span').textContent = this.userData.name;
            }
        }
    }

    cargarDatosConfiguracion() {
        // Cargar configuración desde localStorage para cálculos
        const config = JSON.parse(localStorage.getItem('configuracionCisterna')) || {};
        this.configuracion = config;
    }

    actualizarFechaFooter() {
        if (this.footerDateElement) {
            const now = new Date();
            this.footerDateElement.textContent = now.toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    iniciarActualizaciones() {
        // Actualizar estado del sistema cada 30 segundos
        setInterval(() => this.actualizarEstadoSistema(), 30000);
        this.actualizarEstadoSistema();
        
        // Actualizar última actualización cada minuto
        setInterval(() => this.actualizarUltimaActualizacion(), 60000);
        this.actualizarUltimaActualizacion();
    }

    async actualizarEstadoSistema() {
        try {
            const response = await fetch('/api/level');
            if (!response.ok) throw new Error('Error en la respuesta');
            
            const data = await response.json();
            this.actualizarAlertas(data.level);
            
        } catch (error) {
            console.error('Error actualizando estado:', error);
            this.actualizarAlertas(null, true);
        }
    }

    actualizarAlertas(nivel, error = false) {
        if (!this.alertsList) return;
        
        let alertHTML = '';
        if (error) {
            alertHTML = `<div class="alert-item danger">
                <i class="fas fa-exclamation-triangle"></i> Error de conexión
            </div>`;
        } else if (nivel <= 15) {
            alertHTML = `<div class="alert-item danger">
                <i class="fas fa-exclamation-circle"></i> Nivel crítico (${nivel}%)
            </div>`;
        } else if (nivel <= 30) {
            alertHTML = `<div class="alert-item warning">
                <i class="fas fa-exclamation-triangle"></i> Nivel bajo (${nivel}%)
            </div>`;
        } else if (nivel >= 95) {
            alertHTML = `<div class="alert-item info">
                <i class="fas fa-check-circle"></i> Cisterna casi llena (${nivel}%)
            </div>`;
        } else {
            alertHTML = `<div class="alert-item success">
                <i class="fas fa-check-circle"></i> Sistema normal (${nivel}%)
            </div>`;
        }
        
        this.alertsList.innerHTML = alertHTML;
    }

    actualizarUltimaActualizacion() {
        if (this.lastRefreshElement) {
            this.lastRefreshElement.textContent = new Date().toLocaleTimeString('es-MX');
        }
    }

    seleccionarTipoReporte(tipo) {
        this.currentReportType = tipo;
        
        // Quitar selección anterior
        this.reportCards.forEach(card => card.classList.remove('selected'));
        
        // Agregar selección actual
        document.querySelector(`.report-card[data-report="${tipo}"]`).classList.add('selected');
        
        // Mostrar configuración
        this.reportConfig.style.display = 'block';
        this.reportResults.style.display = 'none';
        
        // Generar filtros según el tipo
        this.generarFiltros(tipo);
        
        this.mostrarMensaje(`Configura el reporte ${this.getNombreReporte(tipo)}`, 'info');
    }

    getNombreReporte(tipo) {
        const nombres = {
            'daily': 'Diario',
            'weekly': 'Semanal',
            'monthly': 'Mensual',
            'custom': 'Personalizado'
        };
        return nombres[tipo] || tipo;
    }

    generarFiltros(tipo) {
        let filtrosHTML = '';
        
        switch(tipo) {
            case 'daily':
                filtrosHTML = `
                    <div class="filter-group">
                        <label for="fechaReporte"><i class="fas fa-calendar"></i> Fecha:</label>
                        <input type="date" id="fechaReporte" class="form-control" 
                               value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="filter-group">
                        <label for="turnoReporte"><i class="fas fa-clock"></i> Turno:</label>
                        <select id="turnoReporte" class="form-control">
                            <option value="complete">Día completo</option>
                            <option value="morning">Mañana (6:00-14:00)</option>
                            <option value="afternoon">Tarde (14:00-22:00)</option>
                            <option value="night">Noche (22:00-6:00)</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="detalleReporte"><i class="fas fa-chart-bar"></i> Nivel de detalle:</label>
                        <select id="detalleReporte" class="form-control">
                            <option value="hourly">Por hora</option>
                            <option value="30min">Cada 30 minutos</option>
                            <option value="15min">Cada 15 minutos</option>
                            <option value="5min">Cada 5 minutos</option>
                        </select>
                    </div>
                `;
                break;
                
            case 'weekly':
                filtrosHTML = `
                    <div class="filter-group">
                        <label for="semanaReporte"><i class="fas fa-calendar-week"></i> Semana:</label>
                        <input type="week" id="semanaReporte" class="form-control"
                               value="${this.getCurrentWeek()}">
                    </div>
                    <div class="filter-group">
                        <label for="tipoGrafico"><i class="fas fa-chart-line"></i> Tipo de gráfico:</label>
                        <select id="tipoGrafico" class="form-control">
                            <option value="line">Líneas</option>
                            <option value="bar">Barras</option>
                            <option value="area">Área</option>
                        </select>
                    </div>
                `;
                break;
                
            case 'monthly':
                filtrosHTML = `
                    <div class="filter-group">
                        <label for="mesReporte"><i class="fas fa-calendar-alt"></i> Mes:</label>
                        <input type="month" id="mesReporte" class="form-control"
                               value="${new Date().toISOString().substring(0, 7)}">
                    </div>
                    <div class="filter-group">
                        <label for="comparativa"><i class="fas fa-balance-scale"></i> Comparar con:</label>
                        <select id="comparativa" class="form-control">
                            <option value="none">No comparar</option>
                            <option value="previous">Mes anterior</option>
                            <option value="average">Promedio anual</option>
                        </select>
                    </div>
                `;
                break;
                
            case 'custom':
                filtrosHTML = `
                    <div class="filter-group">
                        <label for="fechaInicio"><i class="fas fa-calendar-plus"></i> Fecha inicio:</label>
                        <input type="datetime-local" id="fechaInicio" class="form-control"
                               value="${new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().substring(0, 16)}">
                    </div>
                    <div class="filter-group">
                        <label for="fechaFin"><i class="fas fa-calendar-minus"></i> Fecha fin:</label>
                        <input type="datetime-local" id="fechaFin" class="form-control"
                               value="${new Date().toISOString().substring(0, 16)}">
                    </div>
                    <div class="filter-group">
                        <label for="intervaloCustom"><i class="fas fa-ruler"></i> Intervalo (minutos):</label>
                        <input type="number" id="intervaloCustom" class="form-control" 
                               min="1" max="1440" value="30">
                    </div>
                    <div class="filter-group checkbox-group">
                        <label>
                            <input type="checkbox" id="incluirTemperatura" checked>
                            <i class="fas fa-thermometer-half"></i> Incluir temperatura
                        </label>
                        <label>
                            <input type="checkbox" id="incluirAlertas" checked>
                            <i class="fas fa-bell"></i> Incluir eventos de alerta
                        </label>
                    </div>
                `;
                break;
        }
        
        this.filtersContainer.innerHTML = filtrosHTML;
        
        // Inicializar datepickers si es necesario
        if (tipo === 'custom') {
            this.inicializarDatePickers();
        }
    }

    getCurrentWeek() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const pastDaysOfYear = (now - startOfYear) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    }

    inicializarDatePickers() {
        // Configurar Flatpickr para mejores selectores de fecha/hora
        flatpickr("#fechaInicio", {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            locale: "es",
            time_24hr: true
        });
        
        flatpickr("#fechaFin", {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            locale: "es",
            time_24hr: true
        });
    }

    async generarReporte() {
        try {
            this.mostrarMensaje('Generando reporte...', 'info');
            
            // Obtener parámetros del formulario
            const parametros = this.obtenerParametros();
            
            // Validar parámetros
            if (!this.validarParametros(parametros)) {
                this.mostrarMensaje('Por favor completa todos los campos requeridos', 'warning');
                return;
            }
            
            // Ocultar configuración, mostrar loading
            this.reportConfig.style.display = 'none';
            this.mostrarMensaje('Recopilando datos del servidor...', 'info');
            
            // Obtener datos del servidor
            const datos = await this.obtenerDatosReporte(parametros);
            
            // Procesar datos
            const reporte = this.procesarDatosReporte(datos, parametros);
            
            // Mostrar resultados
            this.mostrarResultados(reporte, parametros);
            
            this.mostrarMensaje('Reporte generado exitosamente', 'success');
            
        } catch (error) {
            console.error('Error generando reporte:', error);
            this.mostrarMensaje(`Error: ${error.message}`, 'danger');
        }
    }

    obtenerParametros() {
        const tipo = this.currentReportType;
        let parametros = { tipo };
        
        switch(tipo) {
            case 'daily':
                parametros.fecha = document.getElementById('fechaReporte').value;
                parametros.turno = document.getElementById('turnoReporte').value;
                parametros.detalle = document.getElementById('detalleReporte').value;
                break;
                
            case 'weekly':
                parametros.semana = document.getElementById('semanaReporte').value;
                parametros.grafico = document.getElementById('tipoGrafico').value;
                break;
                
            case 'monthly':
                parametros.mes = document.getElementById('mesReporte').value;
                parametros.comparativa = document.getElementById('comparativa').value;
                break;
                
            case 'custom':
                parametros.inicio = document.getElementById('fechaInicio').value;
                parametros.fin = document.getElementById('fechaFin').value;
                parametros.intervalo = parseInt(document.getElementById('intervaloCustom').value);
                parametros.temperatura = document.getElementById('incluirTemperatura').checked;
                parametros.alertas = document.getElementById('incluirAlertas').checked;
                break;
        }
        
        return parametros;
    }

    validarParametros(parametros) {
        if (!parametros.tipo) return false;
        
        switch(parametros.tipo) {
            case 'custom':
                if (!parametros.inicio || !parametros.fin) return false;
                if (new Date(parametros.inicio) >= new Date(parametros.fin)) {
                    this.mostrarMensaje('La fecha de inicio debe ser anterior a la fecha fin', 'warning');
                    return false;
                }
                break;
        }
        
        return true;
    }

    async obtenerDatosReporte(parametros) {
        let url = '/api/reportes';
        const queryParams = new URLSearchParams();
        
        queryParams.append('tipo', parametros.tipo);
        
        switch(parametros.tipo) {
            case 'daily':
                queryParams.append('fecha', parametros.fecha);
                queryParams.append('turno', parametros.turno);
                break;
                
            case 'weekly':
                queryParams.append('semana', parametros.semana);
                break;
                
            case 'monthly':
                queryParams.append('mes', parametros.mes);
                if (parametros.comparativa !== 'none') {
                    queryParams.append('comparar', parametros.comparativa);
                }
                break;
                
            case 'custom':
                queryParams.append('inicio', parametros.inicio);
                queryParams.append('fin', parametros.fin);
                queryParams.append('intervalo', parametros.intervalo);
                queryParams.append('temperatura', parametros.temperatura);
                queryParams.append('alertas', parametros.alertas);
                break;
        }
        
        url += `?${queryParams.toString()}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }
        
        return await response.json();
    }

    procesarDatosReporte(datos, parametros) {
        // Aquí procesas los datos crudos del servidor
        const reporte = {
            estadisticas: this.calcularEstadisticas(datos),
            datos: datos,
            parametros: parametros,
            timestamp: new Date().toISOString()
        };
        
        // Guardar en memoria para exportación
        this.currentReportData = reporte;
        
        return reporte;
    }

    calcularEstadisticas(datos) {
        if (!datos || datos.length === 0) {
            return {
                promedio: 0,
                minimo: 0,
                maximo: 0,
                consumo: 0,
                totalRegistros: 0
            };
        }
        
        const niveles = datos.map(d => d.level || d.nivel || 0);
        const promedio = niveles.reduce((a, b) => a + b, 0) / niveles.length;
        const minimo = Math.min(...niveles);
        const maximo = Math.max(...niveles);
        
        // Calcular consumo estimado (basado en cambios de nivel y capacidad)
        const capacidad = this.configuracion?.cisternaCapacidad || 10000;
        const consumo = ((maximo - minimo) / 100) * capacidad;
        
        return {
            promedio: Math.round(promedio * 10) / 10,
            minimo: Math.round(minimo * 10) / 10,
            maximo: Math.round(maximo * 10) / 10,
            consumo: Math.round(consumo),
            totalRegistros: datos.length
        };
    }

    mostrarResultados(reporte, parametros) {
        // Mostrar panel de resultados
        this.reportResults.style.display = 'block';
        
        // Actualizar título y rango de fechas
        this.reportTitleElement.textContent = `Reporte ${this.getNombreReporte(parametros.tipo)}`;
        this.reportDateRangeElement.textContent = this.formatearRangoFechas(parametros);
        
        // Actualizar estadísticas
        const stats = reporte.estadisticas;
        this.avgLevelElement.textContent = `${stats.promedio}%`;
        this.minLevelElement.textContent = `${stats.minimo}%`;
        this.maxLevelElement.textContent = `${stats.maximo}%`;
        this.consumptionElement.textContent = `${stats.consumo.toLocaleString()} L`;
        
        // Actualizar tabla
        this.actualizarTablaDatos(reporte.datos);
        
        // Generar gráfico
        this.generarGrafico(reporte.datos, parametros);
    }

    formatearRangoFechas(parametros) {
        const opcionesFecha = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        };
        
        switch(parametros.tipo) {
            case 'daily':
                const fecha = new Date(parametros.fecha);
                return fecha.toLocaleDateString('es-MX', opcionesFecha);
                
            case 'weekly':
                // Parsear año-semana (formato YYYY-Www)
                const [year, week] = parametros.semana.split('-W');
                const fechaInicioSemana = new Date(year, 0, 1 + (week - 1) * 7);
                const fechaFinSemana = new Date(fechaInicioSemana);
                fechaFinSemana.setDate(fechaFinSemana.getDate() + 6);
                
                return `${fechaInicioSemana.toLocaleDateString('es-MX', {day: 'numeric', month: 'short'})} - 
                        ${fechaFinSemana.toLocaleDateString('es-MX', opcionesFecha)}`;
                        
            case 'monthly':
                const [yearMonth, month] = parametros.mes.split('-');
                const fechaMes = new Date(yearMonth, month - 1);
                return fechaMes.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
                
            case 'custom':
                const inicio = new Date(parametros.inicio);
                const fin = new Date(parametros.fin);
                return `${inicio.toLocaleDateString('es-MX', opcionesFecha)} - 
                        ${fin.toLocaleDateString('es-MX', opcionesFecha)}`;
        }
        
        return 'Fecha no especificada';
    }

    actualizarTablaDatos(datos) {
        if (!datos || datos.length === 0) {
            this.reportTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No hay datos disponibles para el período seleccionado</td>
                </tr>
            `;
            return;
        }
        
        let tablaHTML = '';
        
        datos.forEach((registro, index) => {
            const fecha = new Date(registro.timestamp || registro.fecha);
            const hora = fecha.toLocaleTimeString('es-MX', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const nivel = registro.level || registro.nivel || 0;
            const capacidad = this.configuracion?.cisternaCapacidad || 10000;
            const volumen = Math.round((nivel / 100) * capacidad);
            
            let estado = 'Normal';
            let estadoClass = 'status-normal';
            
            if (nivel <= 15) {
                estado = 'Crítico';
                estadoClass = 'status-critical';
            } else if (nivel <= 30) {
                estado = 'Bajo';
                estadoClass = 'status-low';
            } else if (nivel >= 95) {
                estado = 'Lleno';
                estadoClass = 'status-full';
            }
            
            const temperatura = registro.temperature || registro.temperatura || '--';
            
            tablaHTML += `
                <tr>
                    <td>${hora}</td>
                    <td>${nivel.toFixed(1)}%</td>
                    <td>${volumen.toLocaleString()} L</td>
                    <td><span class="status-badge ${estadoClass}">${estado}</span></td>
                    <td>${temperatura}°C</td>
                </tr>
            `;
        });
        
        this.reportTableBody.innerHTML = tablaHTML;
    }

    generarGrafico(datos, parametros) {
        // Ocultar placeholder, mostrar canvas
        document.getElementById('chartPlaceholder').style.display = 'none';
        this.chartCanvas.style.display = 'block';
        
        // Destruir gráfico anterior si existe
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Preparar datos para el gráfico
        const etiquetas = datos.map(d => {
            const fecha = new Date(d.timestamp || d.fecha);
            return fecha.toLocaleTimeString('es-MX', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        });
        
        const niveles = datos.map(d => d.level || d.nivel || 0);
        
        // Determinar tipo de gráfico
        let tipoGrafico = 'line';
        if (parametros.tipo === 'weekly' && parametros.grafico) {
            tipoGrafico = parametros.grafico;
        }
        
        // Crear nuevo gráfico
        const ctx = this.chartCanvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: tipoGrafico,
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Nivel de Agua (%)',
                    data: niveles,
                    borderColor: '#36a2eb',
                    backgroundColor: tipoGrafico === 'line' ? 'transparent' : 'rgba(54, 162, 235, 0.2)',
                    borderWidth: 2,
                    fill: tipoGrafico === 'area',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: `Nivel de Agua - ${this.getNombreReporte(parametros.tipo)}`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Nivel (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hora del día'
                        }
                    }
                }
            }
        });
    }

    cancelarConfiguracion() {
        this.reportConfig.style.display = 'none';
        this.reportCards.forEach(card => card.classList.remove('selected'));
        this.currentReportType = null;
    }

    nuevoReporte() {
        this.reportResults.style.display = 'none';
        this.reportCards.forEach(card => card.classList.remove('selected'));
        this.currentReportType = null;
        this.currentReportData = null;
        
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Mostrar placeholder del gráfico
        document.getElementById('chartPlaceholder').style.display = 'flex';
        this.chartCanvas.style.display = 'none';
        
        this.mostrarMensaje('Selecciona un nuevo tipo de reporte', 'info');
    }

    imprimirReporte() {
        window.print();
    }

    exportarPDF() {
        this.mostrarMensaje('Exportando a PDF... (Funcionalidad en desarrollo)', 'info');
        // Implementar usando jsPDF o similar
    }

    exportarCSV() {
        if (!this.currentReportData || !this.currentReportData.datos) {
            this.mostrarMensaje('No hay datos para exportar', 'warning');
            return;
        }
        
        const datos = this.currentReportData.datos;
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Encabezados
        csvContent += "Fecha,Hora,Nivel(%),Volumen(L),Estado,Temperatura(°C)\n";
        
        // Datos
        datos.forEach(registro => {
            const fecha = new Date(registro.timestamp || registro.fecha);
            const fechaStr = fecha.toLocaleDateString('es-MX');
            const horaStr = fecha.toLocaleTimeString('es-MX');
            const nivel = registro.level || registro.nivel || 0;
            const capacidad = this.configuracion?.cisternaCapacidad || 10000;
            const volumen = Math.round((nivel / 100) * capacidad);
            const temperatura = registro.temperature || registro.temperatura || '';
            
            let estado = 'Normal';
            if (nivel <= 15) estado = 'Crítico';
            else if (nivel <= 30) estado = 'Bajo';
            else if (nivel >= 95) estado = 'Lleno';
            
            csvContent += `${fechaStr},${horaStr},${nivel.toFixed(1)},${volumen},${estado},${temperatura}\n`;
        });
        
        // Crear enlace de descarga
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_cisterna_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.mostrarMensaje('CSV exportado exitosamente', 'success');
    }

    mostrarMensaje(mensaje, tipo = 'info') {
        if (!this.statusMessage || !this.messageContainer) return;
        
        this.statusMessage.textContent = mensaje;
        this.statusMessage.className = `alert-item ${tipo}`;
        this.messageContainer.style.display = 'block';
        
        // Auto-ocultar después de 5 segundos (más para errores)
        const tiempo = tipo === 'danger' ? 8000 : 5000;
        setTimeout(() => {
            if (this.messageContainer) {
                this.messageContainer.style.display = 'none';
            }
        }, tiempo);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new ReportesManager();
});
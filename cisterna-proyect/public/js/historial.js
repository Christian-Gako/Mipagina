// ============================================
// VARIABLES GLOBALES
// ============================================
let currentPage = 1;
let itemsPerPage = 10;
let totalPages = 1;
let totalItems = 0;
let currentFilters = {
    dateRange: 'today',
    sensor: '',
    status: ''
};


document.addEventListener('DOMContentLoaded', async function() {
    // 1. Primero validar sesión
    if (!AuthMiddleware.protectPage()) {
        return; // Si no está autenticado, se redirigió al login
    }
    
    // 2. Si está autenticado, cargar datos del usuario
    const user = AuthMiddleware.getUser();
    
    // Cargar alerta inicial
    actualizarAlertaCisterna();
    
    // Configurar y cargar todo
    configurarEventos();
    cargarHistorial();

});
let currentSort = { field: 'fecha', order: 'desc' };

const sistemaCisterna = window.sistemaCisterna;

// ============================================
// FUNCIONES GLOBALES (accesibles desde HTML)
// ============================================

function verDetalles(registro) {
    if (!registro) {
        mostrarMensaje('Registro no encontrado', 'warning');
        return;
    }
    
    const fecha = new Date(registro.fecha);
    const fechaFormateada = fecha.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    alert(`📋 DETALLES DEL REGISTRO\n\n` +
          `Sensor: ${registro.sensor}\n` +
          `Fecha: ${fechaFormateada}\n` +
          `Nivel: ${registro.nivel}%\n` +
          `Volumen: ${registro.volumen.toLocaleString()} L\n` +
          `Estado: ${registro.estado}\n` +
          `Ubicación: ${registro.ubicacion}\n`);
}

function sortTable(campo) {
    if (currentSort.field === campo) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = campo;
        currentSort.order = 'desc';
    }
    
    actualizarIconosOrden();
    cargarHistorial();
}

// ============================================
// FUNCIÓN PRINCIPAL: CARGAR DATOS DESDE API
// ============================================
async function cargarHistorial() {
    const tbody = document.getElementById('historyTableBody');
    
    // Mostrar loading
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="loading-text">
                <i class="fas fa-spinner fa-spin"></i> Cargando datos desde el servidor...
            </td>
        </tr>
    `;
    
    try {
        // 1. Construir parámetros base
        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage,
            sortBy: obtenerCampoAPI(currentSort.field),
            sortOrder: currentSort.order
        });
        const token = sessionStorage.getItem('authToken');
        
        // 2. Agregar filtro de sensor
        if (currentFilters.sensor && currentFilters.sensor !== '') {
            params.append('sensor', currentFilters.sensor);
        }
        
        // 3. Agregar filtro de estado
        if (currentFilters.status && currentFilters.status !== '') {
            params.append('estado', currentFilters.status);
        }
        
        // 4. Agregar filtro de fecha
        const fechas = obtenerFechasFiltro();
        
        
        if (fechas.inicio) {
            params.append('fechaInicio', fechas.inicio);
        }
        if (fechas.fin) {
            params.append('fechaFin', fechas.fin);
        }
        
        // 5. Llamar a la API con timeout
        const url = `/api/records?${params.toString()}`;
        
        // ... resto del código igual ...
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`/api/records?${params.toString()}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 6. Verificar estructura de respuesta
        if (!data || typeof data !== 'object') {
            throw new Error('Respuesta inválida del servidor');
        }
        
        if (!data.success) {
            // Continuar con datos vacíos si hay error
            data.records = data.records || [];
            data.pagination = data.pagination || { total: 0, totalPages: 0 };
        }
        
        // 7. Actualizar variables
        totalItems = data.pagination?.total || 0;
        totalPages = data.pagination?.totalPages || 1;
        
        // Ajustar página si es necesario
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
        }
        
        // 8. Mostrar datos
        if (!data.records || data.records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-text">
                        <i class="fas fa-database"></i> No se encontraron registros
                    </td>
                </tr>
            `;
        } else {
            actualizarTabla(data.records);
        }
        
        // 9. Actualizar UI
        actualizarPaginacion();
        actualizarInfoResultados();
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        
        // Mostrar error específico
        let mensajeError = 'Error al cargar datos';
        if (error.name === 'AbortError') {
            mensajeError = 'Timeout: El servidor tardó demasiado en responder';
        } else if (error.message.includes('Failed to fetch')) {
            mensajeError = 'No se pudo conectar con el servidor';
        } else {
            mensajeError = error.message;
        }
        
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-text" style="color: var(--danger-color);">
                    <i class="fas fa-exclamation-triangle"></i> ${mensajeError}
                </td>
            </tr>
        `;
        
        mostrarMensaje(mensajeError, 'danger');
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function obtenerCampoAPI(campoFrontend) {
    // Mapear campos del frontend a campos de la API
    const mapeo = {
        'fecha': 'timestamp',
        'nivel': 'value',
        'volumen': 'volumen',
        'estado': 'estado',
        'sensor': 'sensor'
    };
    return mapeo[campoFrontend] || 'timestamp';
}

function obtenerFechasFiltro() {
    const resultado = {};
    const ahora = new Date();
    
    switch(currentFilters.dateRange) {
        case 'today':
            resultado.inicio = ahora.toISOString().split('T')[0];
            resultado.fin = ahora.toISOString().split('T')[0];
            break;
            
        case 'yesterday':
            const ayer = new Date(ahora);
            ayer.setDate(ayer.getDate() - 1);
            resultado.inicio = ayer.toISOString().split('T')[0];
            resultado.fin = ayer.toISOString().split('T')[0];
            break;
            
        case 'week':
            const semanaAtras = new Date(ahora);
            semanaAtras.setDate(semanaAtras.getDate() - 7);
            resultado.inicio = semanaAtras.toISOString().split('T')[0];
            resultado.fin = ahora.toISOString().split('T')[0];
            break;
            
        case 'month':
            const mesAtras = new Date(ahora);
            mesAtras.setDate(mesAtras.getDate() - 30);
            resultado.inicio = mesAtras.toISOString().split('T')[0];
            resultado.fin = ahora.toISOString().split('T')[0];
            break;
            
        case 'quarter':
            const trimestreAtras = new Date(ahora);
            trimestreAtras.setDate(trimestreAtras.getDate() - 90);
            resultado.inicio = trimestreAtras.toISOString().split('T')[0];
            resultado.fin = ahora.toISOString().split('T')[0];
            break;
            
        case 'custom':
            const inicioInput = document.getElementById('startDate');
            const finInput = document.getElementById('endDate');
            const tieneInicio = inicioInput && inicioInput.value && inicioInput.value.trim() !== '';
            const tieneFin = finInput && finInput.value && finInput.value.trim() !== '';
            
            // Condiciones
            if (tieneInicio || tieneFin) {
                if (tieneInicio && tieneFin) {
                    // Ambas fechas tienen valor
                    const inicio = new Date(inicioInput.value);
                    const fin = new Date(finInput.value);
                    
                    if (inicio > fin) {
                        mostrarMensaje("La fecha inicial no puede ser mayor que la fecha final", "warning");
                        // Intercambiar fechas
                        resultado.inicio = finInput.value;
                        resultado.fin = inicioInput.value;
                    } else {
                        resultado.inicio = inicioInput.value;
                        resultado.fin = finInput.value;
                    }
                } 
                else if (tieneInicio && !tieneFin) {
                    // Solo fecha inicio
                    resultado.inicio = inicioInput.value;
                    resultado.fin = inicioInput.value; // Mismo día
                }
                else if (tieneFin && !tieneInicio) {
                    // Solo fecha fin
                    inicioInput.setDate(finInput.getDate()-1);
                    resultado.inicio = finInput.value;
                    resultado.fin = finInput.value; // Mismo día
                }
                // Si son la misma fecha, ya está manejado arriba
            } else {
                // Si ambas están vacías
                resultado.inicio = '1';
                resultado.fin = '1';
                mostrarMensaje("No seleccionaste un rango válido", "warning");
            }
            break;
    }
    
    return resultado;
}

// ============================================
// FUNCIÓN ACTUALIZAR TABLA
// ============================================
function actualizarTabla(datos) {
    const tbody = document.getElementById('historyTableBody');
    
    let html = '';
    datos.forEach(registro => {
        const fecha = new Date(registro.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const claseEstado = getStatusClass(registro.estado);
        
        html += `
            <tr>
                <td>${fechaFormateada}</td>
                <td>${registro.sensor}</td>
                <td>${registro.nivel}%</td>
                <td>${registro.volumen ? registro.volumen.toLocaleString() + ' L' : 'N/A'}</td>
                <td class="status-${claseEstado}">
                    <i class="fas fa-circle"></i> ${registro.estado}
                </td>
                <td>
                    <button class="btn-icon" onclick="verDetalles(${JSON.stringify(registro).replace(/"/g, '&quot;')})" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ============================================
// CONFIGURACIÓN DE EVENTOS
// ============================================
function configurarEventos() {
    // Filtro de rango de fechas
    document.getElementById('dateRange').addEventListener('change', function() {
        const customDates = document.getElementById('customDates');
        customDates.style.display = this.value === 'custom' ? 'flex' : 'none';
        currentFilters.dateRange = this.value;
    });
    
    // Filtro por sensor (No funciona)
    const sensorFilter = document.getElementById('sensorFilter');
    if (sensorFilter) {
        sensorFilter.addEventListener('change', function() {
            currentFilters.sensor = this.value;
        });
    }
    
    // Filtro por estado (No funciona)
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentFilters.status = this.value;
        });
    }
    
    // Registros por página
    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', function() {
            itemsPerPage = parseInt(this.value);
            currentPage = 1;
            
            cargarHistorial();
        });
    }
    
    // Aplicar filtros
    document.getElementById('applyFilters').addEventListener('click', function() {
        currentPage = 1;
        cargarHistorial();
        mostrarMensaje('Filtros aplicados correctamente', 'success');
    });
    
    // Limpiar filtros
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            limpiarFiltros();
        });
    }
    
    // Exportar datos
    document.getElementById('exportBtn').addEventListener('click', function() {
        mostrarModalExportar();
    });
    
    // Botones de paginación
    document.getElementById('firstPage')?.addEventListener('click', () => irAPagina(1));
    document.getElementById('prevPage')?.addEventListener('click', paginaAnterior);
    document.getElementById('nextPage')?.addEventListener('click', paginaSiguiente);
    document.getElementById('lastPage')?.addEventListener('click', () => irAPagina(totalPages));
    
    // Configurar modal de exportación
    document.getElementById('closeExportModal')?.addEventListener('click', cerrarModalExportar);
    document.getElementById('cancelExport')?.addEventListener('click', cerrarModalExportar);
    document.getElementById('confirmExport')?.addEventListener('click', confirmarExportacion);
    
    document.getElementById('exportModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            cerrarModalExportar();
        }
    });
}

// ============================================
// FUNCIONES DE PAGINACIÓN
// ============================================
function actualizarIconosOrden() {
    document.querySelectorAll('.history-table th i').forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    const iconId = `sort${currentSort.field.charAt(0).toUpperCase() + currentSort.field.slice(1)}`;
    const iconElement = document.getElementById(iconId);
    if (iconElement) {
        iconElement.className = currentSort.order === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
}

function actualizarPaginacion() {
    const firstBtn = document.getElementById('firstPage');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const lastBtn = document.getElementById('lastPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (firstBtn) firstBtn.disabled = currentPage <= 1;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (lastBtn) lastBtn.disabled = currentPage >= totalPages;
    
    if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    }
}

function actualizarInfoResultados() {
    const resultsInfo = document.getElementById('resultsInfo');
    if (resultsInfo) {
        const inicio = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
        const fin = Math.min(currentPage * itemsPerPage, totalItems);
        resultsInfo.textContent = `Mostrando ${inicio}-${fin} de ${totalItems} registros`;
    }
}

function limpiarFiltros() {
    // Restablecer valores de formulario
    document.getElementById('dateRange').value = 'today';
    if (document.getElementById('sensorFilter')) {
        document.getElementById('sensorFilter').value = '';
    }
    if (document.getElementById('statusFilter')) {
        document.getElementById('statusFilter').value = '';
    }
    document.getElementById('itemsPerPage').value = '10';
    
    // Ocultar fechas personalizadas
    const customDates = document.getElementById('customDates');
    if (customDates) customDates.style.display = 'none';
    
    
    // Restablecer variables
    currentPage = 1;
    itemsPerPage = 10;
    currentFilters = { dateRange: 'today', sensor: '', status: '' };
    currentSort = { field: 'fecha', order: 'desc' };
    
    // Actualizar UI y cargar datos
    actualizarIconosOrden();
    cargarHistorial();
    mostrarMensaje('Filtros limpiados', 'info');
}

function irAPagina(pagina) {
    if (pagina >= 1 && pagina <= totalPages) {
        currentPage = pagina;
        cargarHistorial();
    }
}

function paginaAnterior() {
    if (currentPage > 1) {
        currentPage--;
        cargarHistorial();
    }
}

function paginaSiguiente() {
    if (currentPage < totalPages) {
        currentPage++;
        cargarHistorial();
    }
}

// ============================================
// FUNCIÓN ACTUALIZAR ALERTAS (INTEGRADA)
// ============================================
async function actualizarAlertaCisterna() {
    try {
        const response = await fetch('/api/level');
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        
        const data = await response.json();
        
        // Usar la misma lógica de alertas que script.js
        actualizarAlertaEnPantalla(data.level);
        
    } catch (error) {
        console.error("Error obteniendo datos:", error);
        mostrarMensaje('Error al obtener el nivel actual', 'danger');
    }
}

function actualizarAlertaEnPantalla(level) {
    const alertsList = document.getElementById('alertsList');
    const lastRefreshElement = document.getElementById('lastRefresh');
    
    if (!alertsList) return;
    
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
    
    alertsList.innerHTML = alertHTML;
    
    // Actualizar timestamp
    if (lastRefreshElement) {
        lastRefreshElement.textContent = new Date().toLocaleString();
    }
}


// ============================================
// SISTEMA DE EXPORTACIÓN - ACTUALIZADO
// ============================================

function mostrarModalExportar() {
    const modal = document.getElementById('exportModal');
    if (!modal) {
        mostrarMensaje('Modal de exportación no disponible', 'warning');
        return;
    }
    
    // Actualizar contador
    const exportCount = document.getElementById('exportCount');
    if (exportCount) {
        exportCount.textContent = totalItems;
    }
    
    // Resetear checkbox "todos los datos"
    const exportAllCheckbox = document.getElementById('exportAllData');
    if (exportAllCheckbox) {
        exportAllCheckbox.checked = false;
    }
    
    modal.style.display = 'flex';
}

function cerrarModalExportar() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function confirmarExportacion() {
    const formato = document.getElementById('exportFormat')?.value || 'csv';
    const exportAll = document.getElementById('exportAllData')?.checked || false;
    
    const columnasSeleccionadas = Array.from(
        document.querySelectorAll('input[name="exportColumn"]:checked')
    ).map(checkbox => checkbox.value);
    
    if (columnasSeleccionadas.length === 0) {
        mostrarMensaje('Selecciona al menos una columna', 'warning');
        return;
    }
    
    try {
        const params = new URLSearchParams({
            sortBy: 'timestamp',  // Siempre ordenar por timestamp
            sortOrder: 'desc',    // Siempre descendente
            format: formato,
            columns: columnasSeleccionadas.join(',')
        });
        
        // Si NO es "todos los datos", aplicar filtros actuales
        if (!exportAll) {
            if (currentFilters.sensor) params.append('sensor', currentFilters.sensor);
            if (currentFilters.status) params.append('estado', currentFilters.status);
            
            const fechas = obtenerFechasFiltro();
            if (fechas.inicio) params.append('fechaInicio', fechas.inicio);
            if (fechas.fin) params.append('fechaFin', fechas.fin);
            
            console.log('📤 Exportando datos filtrados');
        } else {
            // Para "todos los datos", añadir parámetro
            params.append('allData', 'true');
            console.log('Exportando TODOS los datos');
        }
        
        // Redirigir para descargar
        window.location.href = `/api/records/export?${params}`;
        
        cerrarModalExportar();
        mostrarMensaje('Exportación iniciada...', 'info');
        
    } catch (error) {
        console.error('Error exportando:', error);
        mostrarMensaje('Error al exportar: ' + error.message, 'danger');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Botón para abrir modal exportar
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', mostrarModalExportar);
    }
    
    // Botón para confirmar exportación
    const confirmExportBtn = document.getElementById('confirmExport');
    if (confirmExportBtn) {
        confirmExportBtn.addEventListener('click', confirmarExportacion);
    }
    
    // Botón para cancelar exportación
    const cancelExportBtn = document.getElementById('cancelExport');
    if (cancelExportBtn) {
        cancelExportBtn.addEventListener('click', cerrarModalExportar);
    }
    
    // Cerrar modal con la X
    const closeExportModalBtn = document.getElementById('closeExportModal');
    if (closeExportModalBtn) {
        closeExportModalBtn.addEventListener('click', cerrarModalExportar);
    }
    
    // Cerrar modal haciendo clic fuera
    const exportModal = document.getElementById('exportModal');
    if (exportModal) {
        exportModal.addEventListener('click', function(event) {
            if (event.target === exportModal) {
                cerrarModalExportar();
            }
        });
    }
    
    // Actualizar contador cuando cambian los checkboxes de columnas
    const columnCheckboxes = document.querySelectorAll('input[name="exportColumn"]');
    columnCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', actualizarContadorExportacion);
    });
    
    // Actualizar contador cuando cambia el checkbox "todos los datos"
    const exportAllCheckbox = document.getElementById('exportAllData');
    if (exportAllCheckbox) {
        exportAllCheckbox.addEventListener('change', actualizarContadorExportacion);
    }
});

// Función para actualizar el contador de exportación
function actualizarContadorExportacion() {
    const exportCount = document.getElementById('exportCount');
    const exportAll = document.getElementById('exportAllData')?.checked || false;
    
    if (exportCount) {
        if (exportAll) {
            // Aquí necesitas obtener el total de registros del sistema
            // Si no tienes esta información, puedes mostrar "todos" o hacer una petición
            exportCount.textContent = 'todos';
        } else {
            exportCount.textContent = totalItems;
        }
    }
}

// ============================================
// FUNCIÓN AUXILIAR - Obtener campo API
// ============================================

function obtenerCampoAPI(campoFrontend) {
    const mapeoCampos = {
        'timestamp': 'fecha',
        'sensor': 'sensor_id',
        'nivel': 'nivel',
        'volumen': 'volumen',
        'estado': 'estado',
        'ubicacion': 'ubicacion'
    };
    
    return mapeoCampos[campoFrontend] || campoFrontend;
}
// ============================================
// FUNCIONES DE UTILIDAD
// ============================================
function getStatusClass(estado) {
    switch((estado || '').toLowerCase()) {
        case 'normal': return 'normal';
        case 'advertencia': return 'warning';
        case 'crítico': return 'critical';
        default: return 'normal';
    }
}

function mostrarMensaje(mensaje, tipo = 'info') {
    console.log(`${tipo.toUpperCase()}: ${mensaje}`);
    
    const contenedor = document.getElementById('messageContainer') || crearContenedorMensajes();
    
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
    
    const iconos = {
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'danger': 'fa-times-circle',
        'info': 'fa-info-circle'
    };
    
    mensajeDiv.innerHTML = `
        <i class="fas ${iconos[tipo] || 'fa-info-circle'}"></i> ${mensaje}
    `;
    
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

function crearContenedorMensajes() {
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


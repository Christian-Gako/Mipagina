// Simulación de datos de historial
const historialData = [
    { fecha: '2024-01-15 08:30:00', nivel: 85, volumen: 8500, estado: 'Normal', sensor: 'CAP-SENS-001' },
    { fecha: '2024-01-15 09:15:00', nivel: 82, volumen: 8200, estado: 'Normal', sensor: 'CAP-SENS-001' },
    { fecha: '2024-01-15 10:00:00', nivel: 78, volumen: 7800, estado: 'Normal', sensor: 'CAP-SENS-001' },
    { fecha: '2024-01-15 11:45:00', nivel: 65, volumen: 6500, estado: 'Normal', sensor: 'CAP-SENS-001' },
    { fecha: '2024-01-15 13:20:00', nivel: 45, volumen: 4500, estado: 'Advertencia', sensor: 'CAP-SENS-001' },
    { fecha: '2024-01-15 14:30:00', nivel: 35, volumen: 3500, estado: 'Advertencia', sensor: 'CAP-SENS-001' },
    { fecha: '2024-01-15 16:00:00', nivel: 25, volumen: 2500, estado: 'Crítico', sensor: 'CAP-SENS-001' },
    { fecha: '2024-01-15 17:30:00', nivel: 85, volumen: 8500, estado: 'Normal', sensor: 'CAP-SENS-001' }
];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    cargarHistorial();
    configurarEventos();
});

function cargarHistorial() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    historialData.forEach(registro => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${registro.fecha}</td>
            <td>${registro.nivel}%</td>
            <td>${registro.volumen.toLocaleString()} L</td>
            <td class="status-${getStatusClass(registro.estado)}">${registro.estado}</td>
            <td>${registro.sensor}</td>
        `;
        tbody.appendChild(fila);
    });
}

function getStatusClass(estado) {
    switch(estado.toLowerCase()) {
        case 'normal': return 'normal';
        case 'advertencia': return 'warning';
        case 'crítico': return 'critical';
        default: return 'normal';
    }
}

function configurarEventos() {
    // Filtro de rango de fechas
    document.getElementById('dateRange').addEventListener('change', function() {
        const customDates = document.getElementById('customDates');
        customDates.style.display = this.value === 'custom' ? 'flex' : 'none';
    });
    
    // Aplicar filtros
    document.getElementById('applyFilters').addEventListener('click', function() {
        // Simulación de filtrado
        mostrarMensaje('Filtros aplicados correctamente', 'success');
    });
    
    // Exportar datos
    document.getElementById('exportBtn').addEventListener('click', function() {
        mostrarMensaje('Preparando archivo de exportación...', 'info');
        setTimeout(() => {
            mostrarMensaje('Datos exportados correctamente', 'success');
        }, 1500);
    });
}

function mostrarMensaje(mensaje, tipo) {
    // Implementar lógica de mensajes (similar a config.js)
    console.log(`${tipo}: ${mensaje}`);
}
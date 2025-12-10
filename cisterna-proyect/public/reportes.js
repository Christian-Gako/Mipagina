document.addEventListener('DOMContentLoaded', function() {
    configurarReportes();
});
if (!sessionStorage.getItem('authToken')) {
    window.location.href = 'login.html';
    throw new Error('No autenticado');
}
function configurarReportes() {
    const reportCards = document.querySelectorAll('.report-card');
    const reportConfig = document.getElementById('reportConfig');
    const reportResults = document.getElementById('reportResults');
    
    reportCards.forEach(card => {
        card.addEventListener('click', function() {
            const reportType = this.getAttribute('data-report');
            abrirConfiguracionReporte(reportType);
        });
    });
    
    document.getElementById('generateReport').addEventListener('click', function() {
        generarReporte();
    });
    
    document.getElementById('newReport').addEventListener('click', function() {
        reportConfig.style.display = 'none';
        reportResults.style.display = 'none';
    });
}

function abrirConfiguracionReporte(tipo) {
    document.getElementById('reportConfig').style.display = 'block';
    document.getElementById('reportResults').style.display = 'none';
    
    // Configurar según el tipo de reporte
    const fechaInput = document.getElementById('reportDate');
    fechaInput.value = new Date().toISOString().split('T')[0];
}

function generarReporte() {
    const reportResults = document.getElementById('reportResults');
    reportResults.style.display = 'block';
    
    // Simular datos del reporte
    document.getElementById('avgLevel').textContent = '62%';
    document.getElementById('minLevel').textContent = '25%';
    document.getElementById('maxLevel').textContent = '85%';
    document.getElementById('consumption').textContent = '4,200 L';
    
    mostrarMensaje('Reporte generado correctamente', 'success');
}
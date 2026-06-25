// --- CONFIGURACIÓN DE ESTADO ---
const state = {
  currentDate: getLocalDateString(), // Fecha seleccionada (por defecto hoy)
  empleadosAsistencia: [],           // Lista de asistencia del día
  searchQuery: '',                    // Búsqueda de empleados
  ultimoReporteData: []              // Datos del último reporte cargado para descarga de Excel
};

// --- SELECTORES DEL DOM ---
const DOM = {
  // Tabs e Interfaz
  tabAsistencia: document.getElementById('tab-asistencia'),
  tabReportes: document.getElementById('tab-reportes'),
  viewAsistencia: document.getElementById('view-asistencia'),
  viewReportes: document.getElementById('view-reportes'),
  
  // Asistencia
  fechaAsistencia: document.getElementById('fecha-asistencia'),
  btnFechaAnterior: document.getElementById('btn-fecha-anterior'),
  btnFechaSiguiente: document.getElementById('btn-fecha-siguiente'),
  resumenAsistencia: document.getElementById('resumen-asistencia'),
  buscarEmpleado: document.getElementById('buscar-empleado'),
  listaEmpleados: document.getElementById('lista-empleados'),
  
  // Reportes
  reporteDesde: document.getElementById('reporte-desde'),
  reporteHasta: document.getElementById('reporte-hasta'),
  btnConsultarReporte: document.getElementById('btn-consultar-reporte'),
  resultadoReporteContainer: document.getElementById('resultado-reporte-container'),
  reporteRangoTexto: document.getElementById('reporte-rango-texto'),
  tablaReporteCuerpo: document.getElementById('tabla-reporte-cuerpo'),
  totalComidasReporte: document.getElementById('total-comidas-reporte'),
  btnImprimirReporte: document.getElementById('btn-imprimir-reporte'),
  btnDescargarExcel: document.getElementById('btn-descargar-excel'),
  btnDescargarPDF: document.getElementById('btn-descargar-pdf'),
  
  // Configuración de Empleados
  tabEmpleados: document.getElementById('tab-empleados'),
  viewEmpleados: document.getElementById('view-empleados'),
  btnAbrirModal: document.getElementById('btn-abrir-modal'),
  modalEmpleado: document.getElementById('modal-empleado'),
  formEmpleado: document.getElementById('form-empleado'),
  inputNombreEmpleado: document.getElementById('input-nombre-empleado'),
  listaConfigEmpleados: document.getElementById('lista-config-empleados'),
  btnCerrarModal: document.getElementById('btn-cerrar-modal'),
  
  // Toasts
  toast: document.getElementById('toast-notificacion'),
  toastMensaje: document.getElementById('toast-mensaje')
};

// --- FUNCIONES DE FECHAS EN ZONA HORARIA LOCAL ---

// Retorna YYYY-MM-DD en hora local
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Suma o resta días a una fecha (formato YYYY-MM-DD)
function addDays(dateStr, days) {
  const date = new Date(dateStr + 'T12:00:00'); // Evita desfases de zona horaria usando el mediodía
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

// Obtener Lunes y Sábado de la semana actual en base a una fecha
function getWeekRange(dateStr) {
  const current = new Date(dateStr + 'T12:00:00');
  const day = current.getDay(); // 0: Domingo, 1: Lunes, etc.
  
  // Calculamos el lunes (si es domingo, restamos 6; si es lunes, 0; etc.)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);
  
  // Calculamos el sábado (lunes + 5 días)
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  
  return {
    desde: getLocalDateString(monday),
    hasta: getLocalDateString(saturday)
  };
}

// Formato legible para humanos: "Lunes, 24 de Junio"
function formatHumanDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
}

// --- NOTIFICACIONES (TOASTS) ---
let toastTimeout;
function showToast(message, type = 'success') {
  clearTimeout(toastTimeout);
  
  DOM.toastMensaje.textContent = message;
  DOM.toast.className = `toast show ${type}`;
  
  toastTimeout = setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 2500);
}

// --- LÓGICA DE NAVEGACIÓN ---
function setupNavigation() {
  const switchTab = (activeTab, targetView) => {
    // Desactivar todos
    DOM.tabAsistencia.classList.remove('active');
    DOM.tabAsistencia.setAttribute('aria-selected', 'false');
    DOM.tabReportes.classList.remove('active');
    DOM.tabReportes.setAttribute('aria-selected', 'false');
    DOM.tabEmpleados.classList.remove('active');
    DOM.tabEmpleados.setAttribute('aria-selected', 'false');
    
    DOM.viewAsistencia.classList.remove('active');
    DOM.viewReportes.classList.remove('active');
    DOM.viewEmpleados.classList.remove('active');
    
    // Activar seleccionado
    activeTab.classList.add('active');
    activeTab.setAttribute('aria-selected', 'true');
    targetView.classList.add('active');
  };

  DOM.tabAsistencia.addEventListener('click', () => {
    switchTab(DOM.tabAsistencia, DOM.viewAsistencia);
    loadAttendance(); // Recargar por si hubo cambios
  });

  DOM.tabReportes.addEventListener('click', () => {
    switchTab(DOM.tabReportes, DOM.viewReportes);
    // Inicializar rango de fechas del reporte (semana actual: lunes a sábado)
    const rango = getWeekRange(state.currentDate);
    if (!DOM.reporteDesde.value) DOM.reporteDesde.value = rango.desde;
    if (!DOM.reporteHasta.value) DOM.reporteHasta.value = rango.hasta;
  });

  DOM.tabEmpleados.addEventListener('click', () => {
    switchTab(DOM.tabEmpleados, DOM.viewEmpleados);
    cargarListaConfigEmpleados();
  });
}

// --- PETICIONES A LA API (REST) ---

// Cargar la asistencia de la fecha actual
async function loadAttendance() {
  renderLoading();
  
  try {
    const response = await fetch(`/api/asistencia?fecha=${state.currentDate}`);
    if (!response.ok) throw new Error('Error al cargar la asistencia');
    
    state.empleadosAsistencia = await response.ok ? await response.json() : [];
    renderAttendanceList();
    updateSummary();
  } catch (error) {
    console.error(error);
    showToast('No se pudo conectar con el servidor', 'error');
    DOM.listaEmpleados.innerHTML = `
      <div class="loading-spinner-container">
        <p style="color: #E63946; font-weight: 600;">⚠️ Error de conexión</p>
        <button onclick="loadAttendance()" class="btn-secondary-outline" style="margin-top: 8px;">Reintentar</button>
      </div>
    `;
  }
}

// Guardar la asistencia (Al presionar un switch)
async function saveAttendance(empleadoId, comioState, switchElement, cardElement) {
  try {
    const response = await fetch('/api/asistencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empleado_id: empleadoId,
        fecha: state.currentDate,
        comio: comioState
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      // Actualizar estado local
      const empleado = state.empleadosAsistencia.find(e => e.empleado_id === empleadoId);
      if (empleado) empleado.comio = comioState;
      
      // Actualizar diseño de la tarjeta
      if (comioState) {
        cardElement.classList.add('ate');
        cardElement.querySelector('.employee-status-text').textContent = 'Comió';
      } else {
        cardElement.classList.remove('ate');
        cardElement.querySelector('.employee-status-text').textContent = 'No ha comido';
      }
      
      updateSummary();
      showToast('Asistencia actualizada correctamente', 'success');
    } else {
      throw new Error(data.error || 'No se pudo guardar la asistencia');
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Error al guardar la asistencia', 'error');
    // Revertir switch en caso de error
    switchElement.checked = !comioState;
  }
}

// Generar Reporte
async function loadReport() {
  const desde = DOM.reporteDesde.value;
  const hasta = DOM.reporteHasta.value;

  if (!desde || !hasta) {
    showToast('Por favor selecciona ambas fechas', 'error');
    return;
  }

  DOM.btnConsultarReporte.disabled = true;
  DOM.btnConsultarReporte.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0 auto;"></div>';

  try {
    const response = await fetch(`/api/reporte?desde=${desde}&hasta=${hasta}`);
    if (!response.ok) throw new Error('Error al obtener reporte');

    const data = await response.json();
    state.ultimoReporteData = data; // Guardar en el estado para exportar
    renderReport(data, desde, hasta);
    
    // Auto descargar reporte en formato Excel (CSV)
    downloadReportExcel();
  } catch (error) {
    console.error(error);
    showToast('Error al consultar el reporte', 'error');
  } finally {
    DOM.btnConsultarReporte.disabled = false;
    DOM.btnConsultarReporte.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      Consultar Almuerzos
    `;
  }
}

// Descargar el reporte actual en formato Excel real (.xlsx) usando SheetJS
function downloadReportExcel() {
  const data = state.ultimoReporteData;
  const desde = DOM.reporteDesde.value;
  const hasta = DOM.reporteHasta.value;

  if (!data || data.length === 0) {
    showToast('No hay datos para exportar', 'error');
    return;
  }

  try {
    // 1. Mapear datos JSON para renombrar encabezados y quitar IDs
    const datosExcel = data.map(row => ({
      'Empleado': row.nombre,
      'Total Almuerzos': row.total_comidas
    }));

    // Calcular el total general de almuerzos
    const totalComidas = data.reduce((sum, row) => sum + row.total_comidas, 0);

    // Agregar fila de Total General
    datosExcel.push({
      'Empleado': 'Total General',
      'Total Almuerzos': totalComidas
    });

    // 2. Crear la hoja de cálculo y el libro de trabajo
    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Almuerzos');

    // Ajustar anchos de columnas para mejor visualización
    const maxLenNombre = Math.max(...datosExcel.map(row => row['Empleado'].length), 10);
    worksheet['!cols'] = [
      { wch: maxLenNombre + 2 }, // Columna Empleado
      { wch: 18 }                // Columna Total Almuerzos
    ];

    // 3. Forzar descarga del archivo .xlsx
    XLSX.writeFile(workbook, `Reporte_Comidas_${desde}_a_${hasta}.xlsx`);
    showToast('Archivo Excel descargado (.xlsx)', 'success');
  } catch (error) {
    console.error('Error al exportar a Excel:', error);
    showToast('Error al descargar el archivo', 'error');
  }
}

// Descargar el reporte actual en formato PDF usando html2pdf.js
function downloadReportPDF() {
  const desde = DOM.reporteDesde.value;
  const hasta = DOM.reporteHasta.value;

  if (!state.ultimoReporteData || state.ultimoReporteData.length === 0) {
    showToast('No hay datos para exportar', 'error');
    return;
  }

  showToast('Generando PDF...', 'success');

  // Clonar el contenedor para aplicar estilos CSS fijos y universales
  // Esto evita problemas de renderizado en el canvas de html2pdf con variables CSS y fuentes CORS
  const element = DOM.resultadoReporteContainer.cloneNode(true);
  element.style.backgroundColor = '#FFFFFF';
  element.style.color = '#3D405B';
  element.style.fontFamily = 'Arial, sans-serif';
  element.style.padding = '24px';
  element.style.borderRadius = '0px';
  element.style.boxShadow = 'none';
  element.style.border = 'none';

  // Aplicar colores de texto explícitos a todos los elementos del clon
  element.querySelectorAll('td, th, h3, span, strong').forEach(el => {
    el.style.color = '#3D405B';
  });

  // Estilo específico para las cabeceras de tabla
  element.querySelectorAll('th').forEach(th => {
    th.style.backgroundColor = '#F4D3C9'; // Fondo terracota pastel claro
    th.style.color = '#E07A5F';           // Texto terracota
  });

  // Configuración de html2pdf
  const opt = {
    margin:       12,
    filename:     `Reporte_Comidas_${desde}_a_${hasta}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    // Generar el PDF a partir del elemento clonado
    html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('Error al exportar a PDF:', error);
    showToast('Error al descargar el archivo', 'error');
  }
}

// --- RENDERIZADO DINÁMICO ---

function renderLoading() {
  DOM.listaEmpleados.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
      <p>Actualizando lista...</p>
    </div>
  `;
}

// Renderizar la lista de asistencia
function renderAttendanceList() {
  DOM.listaEmpleados.innerHTML = '';
  
  // Filtrar según el buscador
  const filtrados = state.empleadosAsistencia.filter(emp => 
    emp.nombre.toLowerCase().includes(state.searchQuery.toLowerCase())
  );
  
  if (filtrados.length === 0) {
    DOM.listaEmpleados.innerHTML = `
      <div style="text-align: center; padding: 30px; color: var(--text-muted);">
        <p>No se encontraron empleados</p>
      </div>
    `;
    return;
  }
  
  filtrados.forEach(row => {
    const card = document.createElement('div');
    card.className = `employee-card ${row.comio ? 'ate' : ''}`;
    
    // Contenido del empleado
    const info = document.createElement('div');
    info.className = 'employee-info';
    
    const name = document.createElement('span');
    name.className = 'employee-name';
    name.textContent = row.nombre;
    
    const statusText = document.createElement('span');
    statusText.className = 'employee-status-text';
    statusText.textContent = row.comio ? 'Comió' : 'No ha comido';
    
    info.appendChild(name);
    info.appendChild(statusText);
    
    // Switch de control
    const label = document.createElement('label');
    label.className = 'switch';
    label.setAttribute('aria-label', `Marcar comida para ${row.nombre}`);
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = row.comio;
    
    // Asignar ID único para automatización o accesibilidad
    input.id = `switch-emp-${row.empleado_id}`;
    
    const slider = document.createElement('span');
    slider.className = 'slider';
    
    // Evento de cambio táctil
    input.addEventListener('change', (e) => {
      saveAttendance(row.empleado_id, e.target.checked, input, card);
    });
    
    label.appendChild(input);
    label.appendChild(slider);
    
    card.appendChild(info);
    card.appendChild(label);
    
    DOM.listaEmpleados.appendChild(card);
  });
}

// Actualizar resumen numérico superior
function updateSummary() {
  const total = state.empleadosAsistencia.length;
  const comieron = state.empleadosAsistencia.filter(e => e.comio).length;
  DOM.resumenAsistencia.textContent = `${comieron} de ${total} comieron`;
  
  // Cambiar el tono del badge según avance
  if (comieron === 0) {
    DOM.resumenAsistencia.style.backgroundColor = 'var(--primary-light)';
    DOM.resumenAsistencia.style.color = 'var(--primary)';
  } else if (comieron === total) {
    DOM.resumenAsistencia.style.backgroundColor = '#D1EADF';
    DOM.resumenAsistencia.style.color = '#387A5C';
  } else {
    DOM.resumenAsistencia.style.backgroundColor = 'var(--success-light)';
    DOM.resumenAsistencia.style.color = 'var(--success)';
  }
}

// Renderizar tabla de reporte semanal
function renderReport(data, desde, hasta) {
  DOM.tablaReporteCuerpo.innerHTML = '';
  
  // Formatear rango para la cabecera
  const fDesde = desde.split('-').reverse().slice(0, 2).join('/'); // "DD/MM"
  const fHasta = hasta.split('-').reverse().slice(0, 2).join('/'); // "DD/MM"
  DOM.reporteRangoTexto.textContent = `Reporte del ${fDesde} al ${fHasta}`;
  
  let totalComidas = 0;
  
  if (data.length === 0) {
    DOM.tablaReporteCuerpo.innerHTML = `
      <tr>
        <td colspan="2" style="text-align: center; color: var(--text-muted); padding: 20px;">
          Sin registros en este rango de fechas.
        </td>
      </tr>
    `;
    DOM.totalComidasReporte.textContent = '0';
    DOM.resultadoReporteContainer.classList.remove('hidden');
    return;
  }
  
  data.forEach(row => {
    totalComidas += row.total_comidas;
    
    const tr = document.createElement('tr');
    
    const tdNombre = document.createElement('td');
    tdNombre.textContent = row.nombre;
    tdNombre.style.fontWeight = '500';
    
    const tdComidas = document.createElement('td');
    tdComidas.className = 'text-center';
    tdComidas.textContent = row.total_comidas;
    // Si comió bastante, resaltar
    if (row.total_comidas > 0) {
      tdComidas.style.fontWeight = '700';
      tdComidas.style.color = 'var(--success)';
    } else {
      tdComidas.style.color = 'var(--text-muted)';
    }
    
    tr.appendChild(tdNombre);
    tr.appendChild(tdComidas);
    DOM.tablaReporteCuerpo.appendChild(tr);
  });
  
  DOM.totalComidasReporte.textContent = totalComidas;
  DOM.resultadoReporteContainer.classList.remove('hidden');
  
  // Desplazar suavemente hasta los resultados
  DOM.resultadoReporteContainer.scrollIntoView({ behavior: 'smooth' });
}

// --- MANEJO DE FECHA DIARIA ---

function setupDateHandlers() {
  // Inicializar input con la fecha de hoy
  DOM.fechaAsistencia.value = state.currentDate;

  // Cambios manuales en el date picker
  DOM.fechaAsistencia.addEventListener('change', (e) => {
    if (e.target.value) {
      state.currentDate = e.target.value;
      loadAttendance();
    }
  });

  // Botón Día Anterior
  DOM.btnFechaAnterior.addEventListener('click', () => {
    state.currentDate = addDays(state.currentDate, -1);
    DOM.fechaAsistencia.value = state.currentDate;
    loadAttendance();
  });

  // Botón Día Siguiente
  DOM.btnFechaSiguiente.addEventListener('click', () => {
    state.currentDate = addDays(state.currentDate, 1);
    DOM.fechaAsistencia.value = state.currentDate;
    loadAttendance();
  });
}

// --- BUSCADOR ---

function setupSearchHandler() {
  DOM.buscarEmpleado.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderAttendanceList();
  });
}

// --- ACCIONES DE REPORTE ---
function setupReportActions() {
  // Consultar Reporte
  DOM.btnConsultarReporte.addEventListener('click', loadReport);

  // Descargar Excel (.xlsx)
  DOM.btnDescargarExcel.addEventListener('click', downloadReportExcel);

  // Descargar PDF (.pdf)
  DOM.btnDescargarPDF.addEventListener('click', downloadReportPDF);

  // Imprimir Reporte
  DOM.btnImprimirReporte.addEventListener('click', () => {
    window.print();
  });
}

// --- CONFIGURACIÓN DE EMPLEADOS (FRONTEND) ---

async function cargarListaConfigEmpleados() {
  if (!DOM.listaConfigEmpleados) return;
  DOM.listaConfigEmpleados.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner" style="width: 24px; height: 24px; border-width: 3px;"></div>
      <p style="font-size: 0.85rem;">Cargando empleados...</p>
    </div>
  `;

  try {
    const response = await fetch('/api/empleados');
    if (!response.ok) throw new Error('Error al cargar empleados');

    const empleados = await response.json();
    renderizarConfigEmpleados(empleados);
  } catch (error) {
    console.error(error);
    DOM.listaConfigEmpleados.innerHTML = `<p style="color: #E63946; text-align: center; font-size: 0.9rem; padding: 10px;">⚠️ Error al cargar empleados</p>`;
  }
}

function renderizarConfigEmpleados(empleados) {
  if (!DOM.listaConfigEmpleados) return;
  DOM.listaConfigEmpleados.innerHTML = '';

  if (empleados.length === 0) {
    DOM.listaConfigEmpleados.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.9rem; padding: 20px;">No hay empleados registrados en el sistema.</p>`;
    return;
  }

  empleados.forEach(emp => {
    const div = document.createElement('div');
    div.className = 'empleado-item-card';
    div.textContent = emp.nombre;
    DOM.listaConfigEmpleados.appendChild(div);
  });
}

function setupEmployeeActions() {
  // Abrir Modal
  if (DOM.btnAbrirModal && DOM.modalEmpleado) {
    DOM.btnAbrirModal.addEventListener('click', () => {
      if (typeof DOM.modalEmpleado.showModal === 'function') {
        DOM.modalEmpleado.showModal();
      } else {
        DOM.modalEmpleado.classList.add('active');
      }
    });
  }

  // Cancelar/Cerrar Modal
  if (DOM.btnCerrarModal && DOM.modalEmpleado) {
    DOM.btnCerrarModal.addEventListener('click', () => {
      if (typeof DOM.modalEmpleado.close === 'function') {
        DOM.modalEmpleado.close();
      } else {
        DOM.modalEmpleado.classList.remove('active');
      }
    });
  }

  // Guardar Empleado (Form Submit)
  if (DOM.formEmpleado) {
    DOM.formEmpleado.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nombre = DOM.inputNombreEmpleado.value.trim();
      if (!nombre) return;

      try {
        const response = await fetch('/api/empleados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          DOM.formEmpleado.reset();
          
          if (DOM.modalEmpleado && typeof DOM.modalEmpleado.close === 'function') {
            DOM.modalEmpleado.close();
          } else if (DOM.modalEmpleado) {
            DOM.modalEmpleado.classList.remove('active');
          }

          showToast('Empleado agregado con éxito', 'success');
          
          // Recargar lista en configuración
          cargarListaConfigEmpleados();
        } else {
          showToast(data.error || 'Error al agregar empleado', 'error');
        }
      } catch (error) {
        console.error(error);
        showToast('Error de conexión al agregar empleado', 'error');
      }
    });
  }
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupDateHandlers();
  setupSearchHandler();
  setupReportActions();
  setupEmployeeActions();
  
  // Primera carga de asistencia (Hoy)
  loadAttendance();
});

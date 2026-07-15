document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias del DOM y Variables Globales ---
    const tableBody = document.querySelector('#csvTable tbody');
    const noDataMessage = document.getElementById('no-data-message');
    const csvFile = document.getElementById('csvFile');
    const uploadedFileName = document.getElementById('uploadedFileName');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileDropzone = document.getElementById('fileDropzone'); // Nuevo para Drag & Drop
    const reciboContent = document.getElementById('recibo-content');
    const reciboModal = new bootstrap.Modal(document.getElementById('reciboModal'));
    const printBtn = document.getElementById('printBtn');
    
    let globalData = [];

    // --- CONFIGURACIÓN DEL CSV ---
    // Usar una expresión regular para manejar múltiples delimitadores (comas o puntos y comas)
    // Pero si el usuario indicó punto y coma, lo mantenemos como principal.
    const columnSeparator = ';'; 
    const CSV_START_LINE = 2; // Los datos reales comienzan en la línea 3 (índice 2)
    // -----------------------------

    // Mapeo de índices de columna (0-based) a los NOMBRES SOLICITADOS
    const FIELD_MAP = {
        // --- CAMPOS DE ENCABEZADO (Identificación) ---
        'Legajo/Ficha': 0, // Columna 1: N° de Orden
        'Agente (Nombre y Apellido)': 8, // Columna 9: APELLIDO Y NOMBRE
        'CUIT': 5, // Columna 6: CUIL N°
        'Fecha de Ingreso': 9, // Columna 10: FECHA DE INGRESO
        'DENOMINACION DEL CARGO': 14, // Columna 15 (Categoría)
        'AÑOS': 10, // Columna 11: AÑOS
        'MES REAL DE LA LIQUIDACION': 3, // Columna 4: MES REAL DE LA LIQUIDACION
        
        // --- REMUNERATIVOS --- 
        'SUELDO BASICO DOCENTE': 23, // Columna 24
        'DEDIC. EXCLUSIVA DIRCTIVO DOCENTE': 24, // Columna 25
        'BONIF-ANTIG': 32, // Columna 33
        'COMPLEMENTO SALARIAL DOCENTE REMUNERATIVA': 25, // Columna 26
        'COMPLEMENTO REMUNERATIVO': 26, // Columna 27
        'COMPL.SUELDO MIN. REMUNERATIVA': 28, // Columna 29
        'ADICIONAL FORMACION PERMANENTE REMUNERATIVA': 29, // Columna 30
        'COMPENSACION FONID REMUN DIREC': 30, // Columna 31
        
        // --- NO REMUNERATIVOS ---
        'ADICIONAL FORMACION PERMANENTE (DOCENTE NO REMUNERATIVO)': 51, // Columna 52
        'CONECTIVIDAD PCIAL DOCENTE NO REMUNERATIVA': 52, // Columna 53
        
        // --- DESCUENTOS ---
        'SIJP 11%': 35, // Columna 36
        'INNSP 3%': 36, // Columna 37
        'A. EXTRAORD JUBIL 2%': 37, // Columna 38
        'CAJA COMPLEMENTARIA 4,5%': 38, // Columna 39
        'IPROSS 4% / OSPAD 3%': 39, // Columna 40
        'SEGURO DE VIDA IAPS': 41, // Columna 42
    };

    // Claves agrupadas para reutilización
    const remunKeys = ['SUELDO BASICO DOCENTE', 'DEDIC. EXCLUSIVA DIRCTIVO DOCENTE', 'COMPLEMENTO SALARIAL DOCENTE REMUNERATIVA', 'COMPLEMENTO REMUNERATIVO', 'COMPL.SUELDO MIN. REMUNERATIVA', 'ADICIONAL FORMACION PERMANENTE REMUNERATIVA', 'COMPENSACION FONID REMUN DIREC', 'BONIF-ANTIG'];
    const noRemunKeys = ['ADICIONAL FORMACION PERMANENTE (DOCENTE NO REMUNERATIVO)', 'CONECTIVIDAD PCIAL DOCENTE NO REMUNERATIVA'];
    const descuentoKeys = ['SIJP 11%', 'INNSP 3%', 'A. EXTRAORD JUBIL 2%', 'CAJA COMPLEMENTARIA 4,5%', 'IPROSS 4% / OSPAD 3%', 'SEGURO DE VIDA IAPS'];
    const nonNumericKeys = ['Legajo/Ficha', 'Agente (Nombre y Apellido)', 'CUIT', 'Fecha de Ingreso', 'DENOMINACION DEL CARGO', 'AÑOS', 'MES REAL DE LA LIQUIDACION'];


    // Función para generar el HTML del indicador de archivo
    const getUploadText = (fileName, isDefault = false) => {
        const iconClass = isDefault ? 'text-secondary' : 'text-primary';
        const text = isDefault ? 'Arrastra un archivo aquí o haz clic en "Seleccionar Archivo"...' : fileName;
        return `<i class="bi bi-filetype-csv me-2 ${iconClass}"></i> ${text}`;
    }

    // Inicializa el mensaje y deshabilita el botón de Subir
    const resetFileState = () => {
        noDataMessage.style.display = 'block';
        uploadedFileName.innerHTML = getUploadText('Ningún archivo seleccionado...', true);
        uploadBtn.disabled = true;
        csvFile.value = ''; // Limpiar input file
    }
    
    resetFileState();

    // --- Lógica de Carga y Drag & Drop de Archivos ---

    // 1. Manejo del evento 'change' (selección de archivo)
    csvFile.addEventListener('change', () => {
        const file = csvFile.files[0];
        if (file) {
            uploadedFileName.innerHTML = getUploadText(file.name);
            uploadBtn.disabled = false;
        } else {
            resetFileState();
        }
    });

    // 2. Manejo de Drag & Drop (mejoras de UX)
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileDropzone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        fileDropzone.addEventListener(eventName, () => {
            fileDropzone.classList.add('border-primary', 'border-3');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileDropzone.addEventListener(eventName, () => {
            fileDropzone.classList.remove('border-primary', 'border-3');
        }, false);
    });

    fileDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            // Asignar el archivo al input file
            csvFile.files = files; 
            // Disparar el evento 'change' manualmente para actualizar la UI
            csvFile.dispatchEvent(new Event('change'));
        }
    }, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 3. Manejo del botón 'Procesar y Cargar'
    uploadBtn.addEventListener('click', () => {
        const file = csvFile.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const csv = e.target.result;
            processCSV(csv);
            uploadBtn.disabled = true;
        };
        reader.readAsText(file);
    });

    /**
     * Procesa el contenido del CSV, lo almacena globalmente y renderiza la tabla.
     */
    function processCSV(csv) {
        // Reemplazar saltos de línea de Windows (\r\n) a Unix (\n) y filtrar líneas vacías
        const lines = csv.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
        
        if (lines.length <= CSV_START_LINE) {
            resetFileState();
            alert('El archivo CSV está vacío o solo contiene encabezados.');
            return;
        }

        // Dividir líneas a partir del índice de inicio
        globalData = lines.slice(CSV_START_LINE).map(line => {
            // Usar una expresión regular para una división más robusta que maneje comillas si fuera necesario,
            // pero nos limitamos al separador principal para mantener la simplicidad y el rendimiento.
            return line.split(columnSeparator);
        });

        tableBody.innerHTML = '';
        
        let validReciboCount = 0;
        globalData.forEach((row, index) => {
            // Validar que la fila contenga suficientes columnas y datos para los campos clave
            if (row.length > 20 && row[FIELD_MAP['Legajo/Ficha']] && row[FIELD_MAP['Agente (Nombre y Apellido)']]) {
                const tr = document.createElement('tr');
                
                tr.innerHTML = `
                    <td>${row[FIELD_MAP['Legajo/Ficha']] || 'N/A'}</td>
                    <td>${row[FIELD_MAP['Agente (Nombre y Apellido)']] || 'N/A'}</td>
                    <td>${row[FIELD_MAP['MES REAL DE LA LIQUIDACION']] || 'N/A'}</td> 
                    <td class="text-end">
                        <button class="btn btn-sm btn-info text-white btn-sm-custom ver-recibo-btn" data-index="${index}">
                            <i class="bi bi-eye-fill"></i> Ver Recibo
                        </button>
                    </td>
                `;

                tableBody.appendChild(tr);
                validReciboCount++;
            }
        });

        if (validReciboCount === 0) {
            resetFileState();
            alert('No se encontraron recibos válidos en el archivo (verifica que la fila de datos comience en la línea 3).');
        } else {
            noDataMessage.style.display = 'none';
            // Mensaje de éxito más discreto
            // alert(`¡Carga exitosa! Se procesaron ${validReciboCount} recibos.`); 
        }

        // Asignar el evento click a los botones de "Ver Recibo"
        document.querySelectorAll('.ver-recibo-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const rowIndex = e.currentTarget.dataset.index;
                showReciboModal(globalData[rowIndex]);
            });
        });
    }

    // --- Funciones de Utilidad y Lógica del Recibo ---

    /**
     * Formatea un número como moneda (ej: $ 1.234,56).
     */
    const formatCurrency = (num) => {
        if (isNaN(num) || !isFinite(num)) {
            return '$ 0,00'; 
        }
        return num.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
    };

    /**
     * Función que extrae, parsea y organiza todos los valores de una fila.
     */
    function extractValues(rowData) {
        const values = {};

        for (const key in FIELD_MAP) {
            const index = FIELD_MAP[key];
            let rawValue = (rowData[index] || '').trim();
            
            if (!nonNumericKeys.includes(key)) {
                // Reemplazar punto por nada y luego coma por punto para un correcto parseo de float
                // Esto maneja formatos de miles como: 1.234,56 -> 1234.56
                rawValue = rawValue.replace(/\./g, '').replace(',', '.');
                values[key] = parseFloat(rawValue) || 0; 
            } else {
                values[key] = rawValue;
            }
        }

        // --- Cálculos de Totales ---
        values.totalRemuneraciones = remunKeys.reduce((sum, key) => sum + (values[key] || 0), 0);
        values.totalNoRemunerativos = noRemunKeys.reduce((sum, key) => sum + (values[key] || 0), 0);
        // Descuentos siempre deben ser positivos en el cálculo, aunque en el CSV aparezcan como positivos.
        values.totalDescuentos = descuentoKeys.reduce((sum, key) => sum + Math.abs(values[key] || 0), 0); 

        values.netoACobrar = values.totalRemuneraciones + values.totalNoRemunerativos - values.totalDescuentos;
        
        return values;
    }


    /**
     * Función principal para mostrar el recibo en el modal.
     */
    function showReciboModal(rowData) {
        const values = extractValues(rowData);
        
        // Función para generar la lista de conceptos HTML
        const createConceptList = (keys, groupLabel) => {
            let content = '';
            // Usamos una lista no ordenada para mejor estructura semántica
            content += '<ul class="list-unstyled mb-0 small">';
            
            keys.forEach(key => {
                // Mostrar solo conceptos con valor mayor a cero
                if (values[key] > 0.01) { 
                    content += `<li>${key} <span class="float-end fw-bold">${formatCurrency(values[key])}</span></li>`;
                }
            });
            
            content += '</ul>';

            if (content.indexOf('<li>') === -1) {
                return `<div class="text-center text-muted py-2"><small>No hay ${groupLabel}</small></div>`;
            }
            return content;
        };

        const remunerativosContent = createConceptList(remunKeys, 'haberes remunerativos');
        const noRemunerativosContent = createConceptList(noRemunKeys, 'haberes no remunerativos');
        const descuentosContent = createConceptList(descuentoKeys, 'descuentos');

        // Renderizado del Recibo
        reciboContent.innerHTML = `
            <div class="recibo-container">
                <div class="row mb-4 align-items-start">
                    <div class="col-md-6 col-12 text-start">
                        <h5 class="mt-0 fw-bold text-dark">ESTABLECIMIENTO: INSTITUCIÓN PADRE JOSÉ MARÍA BRENTANA G-028</h5>
                        <p class="mb-0 small">Localidad: Cipolletti - Río Negro</p>
                        <p class="mb-0 small">Domicilio: JUAN XXIII N° 940</p>
                        <p class="mb-1 small"><strong>CUIT:</strong> 33-60859242-9 &nbsp; &nbsp; <strong>Teléfono:</strong> 2994781836</p>
                    </div>
                    <div class="col-md-6 col-12 text-end">
                        <img src="https://tse1.mm.bing.net/th/id/OIP.YtezZGubxnCMToLGkmp_FAAAAA?pid=Api&P=0&h=180" width="80" alt="Logo Empresa" class="d-block ms-auto">
                    </div>
                    <div class="col-12 text-center mt-3">
                        <h4 class="mb-0 text-primary fw-bold border-bottom pb-2">RECIBO OFICIAL DE HABERES</h4>
                    </div>
                </div>
                
                <div class="info-section row g-2 mb-4 p-3 border rounded bg-light">
                    <div class="col-md-6">
                        <p class="mb-0"><strong>Legajo/Ficha:</strong> ${values['Legajo/Ficha']}</p>
                        <p class="mb-0"><strong>Agente:</strong> ${values['Agente (Nombre y Apellido)']}</p>
                        <p class="mb-0"><strong>Categoría:</strong> ${values['DENOMINACION DEL CARGO']}</p>
                    </div>
                    <div class="col-md-6">
                        <p class="mb-0"><strong>CUIL:</strong> ${values['CUIT']}</p>
                        <p class="mb-0"><strong>Período:</strong> ${values['MES REAL DE LA LIQUIDACION']}</p>
                        <p class="mb-0"><strong>Antigüedad:</strong> ${values['AÑOS']} años (Ingreso: ${values['Fecha de Ingreso']})</p>
                    </div>
                </div>

                <table class="recibo-table table table-bordered">
                    <thead>
                        <tr>
                            <th>Conceptos Remunerativos</th>
                            <th>Conceptos No Remunerativos</th>
                            <th>Descuentos</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="recibo-conceptos-col align-top">${remunerativosContent}</td>
                            <td class="recibo-conceptos-col align-top">${noRemunerativosContent}</td>
                            <td class="recibo-conceptos-col align-top">${descuentosContent}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="table-secondary">
                            <td class="text-end fw-bold small">TOTAL REMUNERATIVO: ${formatCurrency(values.totalRemuneraciones)}</td>
                            <td class="text-end fw-bold small">TOTAL NO REMUN.: ${formatCurrency(values.totalNoRemunerativos)}</td>
                            <td class="text-end fw-bold small">TOTAL DESCUENTOS: ${formatCurrency(values.totalDescuentos)}</td>
                        </tr>
                        <tr>
                            <td colspan="2" class="text-end fw-bold align-middle bg-light">NETO A COBRAR:</td>
                            <td colspan="1" class="text-center neto-cobrar-cell">
                                ${formatCurrency(values.netoACobrar)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
                
                <p class="text-muted fst-italic text-center mt-4">
                    Son: ${convertirNumeroALetras(values.netoACobrar).toUpperCase()} PESOS.
                </p>
                <p class="text-center mt-5 mb-5">
                    <small>Recibí conforme el importe líquido resultante de la presente liquidación, no teniendo nada más que reclamar por los conceptos de este recibo.</small>
                </p>
                
                <div class="row pt-3 border-top border-secondary-subtle">
                    <div class="col-6 text-center">
                        <p class="mb-5">..............................................</p>
                        <p class="fw-bold">Firma del Empleador</p>
                    </div>
                    <div class="col-6 text-center">
                        <p class="mb-5">..............................................</p>
                        <p class="fw-bold">Firma del Empleado</p>
                    </div>
                </div>
            </div>
        `;
        
        reciboModal.show();
    }
    
    /**
     * Convierte un número (importe) a su representación en letras.
     */
    function convertirNumeroALetras(num) {
        if (isNaN(num) || !isFinite(num)) return 'CERO';
        num = Math.abs(num); 
        
        let entero = Math.floor(num);
        let decimal = Math.round((num - entero) * 100);

        const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
        const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
        const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
        const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

        function toHundreds(n) {
            let s = '';
            if (n === 0) return '';

            if (n >= 100) {
                if (n === 100) s += 'cien';
                else s += centenas[Math.floor(n / 100)];
                n %= 100;
                if (n > 0) s += ' ';
            }
            if (n >= 20) {
                s += decenas[Math.floor(n / 10)];
                n %= 10;
                if (n > 0) s += ' y ';
            }
            if (n >= 10) {
                s += especiales[n - 10];
                n = 0;
            }
            if (n > 0) {
                s += unidades[n];
            }
            return s.trim();
        }

        let letras = '';
        if (entero === 0) {
            letras = 'cero';
        } else {
            let millones = Math.floor(entero / 1000000);
            let miles = Math.floor((entero % 1000000) / 1000);
            let restos = entero % 1000;

            if (millones > 0) {
                // CORRECCIÓN: "un millón" vs "millones"
                if (millones === 1) letras += 'un millón ';
                else letras += toHundreds(millones) + ' millones ';
            }
            if (miles > 0) {
                // CORRECCIÓN: "mil" vs "un mil"
                if (miles === 1 && millones === 0) letras += 'mil '; // Si no hay millones y es 1000-1999
                else if (miles === 1) letras += 'mil '; // Si hay millones y es 1001000-1001999
                else letras += toHundreds(miles) + ' mil ';
            }
            if (restos > 0) {
                letras += toHundreds(restos);
            }
        }

        let decimalesStr = String(decimal).padStart(2, '0');
        // Asegura que la primera letra esté en minúscula si no es 'un' o 'cero'
        letras = letras.trim();
        return letras + ' con ' + decimalesStr + '/100';
    }


    // Lógica para el botón Imprimir
    printBtn.addEventListener('click', () => {
        // Enlazar la impresión al contenido del modal
        const modalContent = document.getElementById('reciboModal').innerHTML;
        const originalBody = document.body.innerHTML;
        
        // Crea una ventana temporal para el contenido de impresión
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Impresión de Recibo</title>');
        // Incluye los estilos
        printWindow.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">');
        printWindow.document.write('<link rel="stylesheet" href="style.css">');
        printWindow.document.write('</head><body>');
        // Envuelve el contenido del recibo en un contenedor para que los estilos de @media print lo capturen
        printWindow.document.write('<div id="reciboModal" class="modal-content">');
        printWindow.document.write(document.getElementById('recibo-content').outerHTML);
        printWindow.document.write('</div></body></html>');
        
        printWindow.document.close();
        printWindow.focus();
        // Espera un momento a que los estilos carguen y luego imprime
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500); // 500ms de espera
    });
});
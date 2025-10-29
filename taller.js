// taller.js - Versión corregida
const API_BASE = 'https://server-jzk9.onrender.com';
let colorSeleccionado = "";

console.log("✅ taller.js cargado"); // Para debug

// Pantalla 1 → Pantalla 2
document.getElementById("orbe-grande").addEventListener("click", () => {
    console.log("🎯 Orbe grande clickeado");
    document.getElementById("screen1").classList.remove("active");
    document.getElementById("screen2").classList.add("active");
});

// Pantalla 2 → Pantalla 3
document.querySelectorAll("#screen2 .color-wrap").forEach((el, index) => {
    el.addEventListener("click", () => {
        const colores = ["azul", "rojo", "amarillo", "naranja"];
        colorSeleccionado = colores[index];
        console.log("🎨 Color seleccionado:", colorSeleccionado);
        
        document.getElementById("screen2").classList.remove("active");
        document.getElementById("screen3").classList.add("active");
        
        // Enfocar el input después de cambiar de pantalla
        setTimeout(() => {
            const input = document.getElementById("userInput");
            if (input) {
                input.focus();
                console.log("📝 Input enfocado");
            }
        }, 100);
    });
});

// Pantalla 3 → Pantalla 4 - VERSIÓN CORREGIDA
function setupInputListener() {
    const input = document.getElementById("userInput");
    
    if (!input) {
        console.log("❌ No se encontró el input userInput");
        return;
    }
    
    console.log("✅ Input encontrado, agregando listener...");
    
    // Remover listener anterior si existe
    input.removeEventListener("keydown", handleEnterKey);
    
    // Agregar nuevo listener
    input.addEventListener("keydown", handleEnterKey);
}

function handleEnterKey(e) {
    console.log("⌨️ Tecla presionada:", e.key);
    
    if (e.key === "Enter" && e.target.value.trim() !== "") {
        e.preventDefault();
        console.log("✅ Enter presionado con texto");
        
        const mensaje = e.target.value.trim();
        console.log("📝 Mensaje a enviar:", mensaje);
        console.log("🎨 Color:", colorSeleccionado);
        
        // Enviar al servidor
        enviarRespuesta(colorSeleccionado, mensaje);
        
        // Cambiar a pantalla 4
        document.getElementById("screen3").classList.remove("active");
        document.getElementById("screen4").classList.add("active");
        
        // Limpiar input
        e.target.value = "";
    }
}

async function enviarRespuesta(color, mensaje) {
    try {
        console.log("📤 Enviando al servidor...");
        const response = await fetch(API_BASE + '/api/save-response', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                color_seleccionado: color, 
                message: mensaje 
            })
        });
        
        if (response.ok) {
            console.log("✅ Respuesta guardada en servidor");
        } else {
            console.log("⚠️ Error en servidor:", response.status);
        }
    } catch (error) {
        console.log("❌ Error de conexión:", error);
    }
}

// INICIALIZACIÓN - Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 DOM cargado, inicializando...");
    setupInputListener();
});

// También configurar el input cuando se cambia a pantalla 3
// Observar cambios en las pantallas
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (document.getElementById("screen3").classList.contains("active")) {
                console.log("🔄 Pantalla 3 activada, configurando input...");
                setTimeout(setupInputListener, 50);
            }
        }
    });
});

// Iniciar observador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    const screen3 = document.getElementById("screen3");
    if (screen3) {
        observer.observe(screen3, { attributes: true });
    }
    setupInputListener();
});

// backend/server.js

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { generatePDF } = require("./generatePdf");
require('dotenv').config(); // Cargar variables de entorno

const app = express();
const PORT = 3000;

// Configurar CORS y JSON parsing
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Servir frontend
app.use(express.static(path.join(__dirname, "../frontend")));

app.use('/test', express.static(path.join(__dirname, 'test.html')));

// Servir archivos estáticos de MapLibre desde /public
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Ruta para generar el PDF
app.post("/generate-pdf", async (req, res) => {
    try {
        const { title, names, date, location, lat, lng } = req.body;
        console.log("Solicitud para generar PDF recibida:", { title, names, date, location, lat, lng });

        // Validar los datos
        if (!title || !names || !date || !location || typeof lat !== 'number' || typeof lng !== 'number') {
            return res.status(400).json({ error: "Datos del formulario incompletos o inválidos." });
        }

        const pdfPath = await generatePDF(title, names, date, location, lat, lng);
        console.log("PDF generado en:", pdfPath);

        res.download(pdfPath, "mapa.pdf", (err) => {
            if (err) {
                console.error("Error al enviar el PDF:", err);
                res.status(500).json({ error: "Error enviando el PDF" });
            } else {
                console.log("PDF enviado correctamente.");
                // Eliminar el PDF después de enviarlo
                fs.unlink(pdfPath, (err) => {
                    if (err) {
                        console.error("Error al eliminar el PDF:", err);
                    } else {
                        console.log("PDF eliminado del servidor.");
                    }
                });
            }
        });
    } catch (error) {
        console.error("Error generando PDF:", error);
        res.status(500).json({ error: "Error generando el PDF" });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

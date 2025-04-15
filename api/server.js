// api/server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const serverless = require("serverless-http");
const { generatePDF } = require("./generatePdf");
require('dotenv').config();

const app = express();

// Configurar CORS y JSON parsing
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Servir archivos estáticos del frontend
// Nota: en una función serverless es recomendable servir el frontend desde Vercel como sitio estático
// O bien, si lo incluyes aquí, asegúrate de que las rutas sean correctas.
app.use(express.static(path.join(__dirname, "../frontend")));

// Servir archivos estáticos de MapLibre desde /public
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.post("/generate-pdf", async (req, res) => {
    try {
        const { title, names, date, location, lat, lng } = req.body;
        console.log("Solicitud para generar PDF recibida:", { title, names, date, location, lat, lng });

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

// En un entorno serverless NO usamos app.listen, sino que exportamos el handler.
module.exports = serverless(app);

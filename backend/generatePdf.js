// backend/generatePdf.js

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
require('dotenv').config(); // Cargar variables de entorno

// Añade esta función de utilidad al principio del archivo
function decimalToDMS(decimal, isLatitude) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

    const direction = isLatitude 
        ? (decimal >= 0 ? "N" : "S")
        : (decimal >= 0 ? "E" : "W");

    return `${degrees}º ${minutes}' ${seconds}"${direction}`;
}

async function generatePDF(title, names, date, location, lat, lng) {
    let browser = null;
    try {
        const API_KEY = process.env.MAPTILER_API_KEY;
        if (!API_KEY) {
            throw new Error("La clave de API de MapTiler no está definida en las variables de entorno.");
        }

        // URL del mapa y estilo de MapTiler
        const tileURL = `https://api.maptiler.com/maps/a1f9aafb-b195-4c49-be66-1ee2b0066ec7/style.json?key=${API_KEY}`;

        console.log("Iniciando Puppeteer...");
        browser = await puppeteer.launch({
            headless: true, // Cambiar a false para depuración visual
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Configurar el tamaño de la página si es necesario
        await page.setViewport({ width: 1000, height: 1050 });

        // Construir una página HTML con MapLibre en el backend
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <link href="http://localhost:3000/public/maplibre/maplibre-gl.css" rel="stylesheet" />
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        margin: 0; 
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        background-color: #ffffff; /* Fondo blanco */
                    }
                    h1 { font-size: 24px; font-weight: bold; margin: 10px 0; }
                    p { font-size: 18px; margin: 5px 0; }
                    /* Contenedor del mapa */
                    #map-container {
                        width: 1000px;
                        height: 1000px; /* Coincide con las dimensiones de la máscara */
                        position: relative;
                        overflow: hidden;
                        background-color: #ffffff; /* Fondo blanco */
                        /* Aplicar clip-path para recortar en forma de corazón */
                        /* clip-path: path("M250,30 C100,-50 -120,200 250,450 620,200 400,-50 250,30Z"); */
                    }
                    /* Estilos del mapa */
                    #map {
                        width: 100%;
                        height: 100%;
                    }
                    .maplibregl-ctrl-bottom-right.mapboxgl-ctrl-bottom-right {
                        display: none;
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <p>${names}</p>
                <p>${location} - ${date}</p>
                <!-- Contenedor del mapa con clip-path -->
                <div id="map-container">
                    <div id="map"></div>
                </div>
                <script src="http://localhost:3000/public/maplibre/maplibre-gl.js"></script>
                <script>
                    window.map = new maplibregl.Map({
                        container: 'map',
                        style: '${tileURL}',
                        center: [${lng}, ${lat}], // [lng, lat]
                        zoom: 13.1
                    });

                    console.log("MapLibre map object:", window.map);

                    // Añadir marcador en forma de corazón
                    window.map.on('load', () => {
                        const el = document.createElement('div');
                        el.innerHTML = '<img src="http://localhost:3000/public/maplibre/heart.svg" width="40" height="40" />';
                        new maplibregl.Marker(el)
                            .setLngLat([${lng}, ${lat}])
                            .addTo(window.map);
                    });
                </script>
            </body>
            </html>
        `;

        console.log("Configurando el contenido de la página...");
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });
        console.log("Contenido de la página configurado.");

        console.log("Esperando al selector '#map-container'...");
        await page.waitForSelector('#map-container');
        console.log("Selector '#map-container' encontrado.");

        console.log("Esperando a que el estilo del mapa se cargue...");
        await page.waitForFunction(() => {
            return window.map && window.map.isStyleLoaded();
        }, { timeout: 20000 }); // Aumentado a 20 segundos
        console.log("Estilo del mapa cargado.");

        // console.log("Esperando 5 segundos adicionales...");
        // await new Promise(resolve => setTimeout(resolve, 5000)); // Aumentado a 5 segundos
        // console.log("Tiempo de espera finalizado.");

        // Tomar una captura de pantalla del contenedor del mapa
        const mapContainer = await page.$('#map-container');
        const mapScreenshotPath = path.join(__dirname, "map.png");
        await mapContainer.screenshot({ path: mapScreenshotPath });
        console.log("Captura de pantalla del mapa tomada:", mapScreenshotPath);

        // Leer la imagen capturada y convertirla a Base64 para incrustarla en el HTML del PDF
        const processedImageBuffer = fs.readFileSync(mapScreenshotPath);
        const processedImageBase64 = processedImageBuffer.toString('base64');
        const imgSrc = `data:image/png;base64,${processedImageBase64}`;

        // Crear el contenido HTML para el PDF con la imagen procesada y aplicar estilos tipográficos
        const pdfHtmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Caveat&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Pacifico&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Roboto&display=swap');
                
                body { 
                    font-family: 'Roboto', sans-serif; 
                    text-align: center; 
                    margin: 0; 
                    padding: 20px;
                    background-color: #ffffff;
                }
                h1 {
                    font-family: 'Caveat', cursive;
                    font-size: 85px;
                    font-weight: 300;
                    margin-top: 60px;
                    margin-bottom: -10px;
                }
                .info-container p:not(.names) {
                    font-family: 'Roboto', sans-serif;
                    font-size: 40px;
                    margin: 5px 0;
                    font-weight: 100;
                }
                .names {
                    font-size: 30px;
                    font-weight: bold;
                    margin-bottom: 15px;
                }
                .mask-container {
                    width: 700px; 
                    height: 700px; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    clip-path: path("M380.63,32.196C302.639,33.698,264.47,88.893,256,139.075c-8.47-50.182-46.638-105.378-124.63-106.879 C59.462,30.814,0,86.128,0,187.076c0,129.588,146.582,189.45,246.817,286.25c3.489,3.371,2.668,3.284,2.668,3.284 c1.647,2.031,4.014,3.208,6.504,3.208v0.011c0,0,0.006,0,0.011,0c0,0,0.006,0,0.011,0v-0.011c2.489,0,4.856-1.177,6.503-3.208 c0,0-0.821,0.086,2.669-3.284C365.418,376.526,512,316.664,512,187.076C512,86.128,452.538,30.814,380.63,32.196z");
                    position: relative;
                    transform: scale(2) translateX(29.5%) translateY(29%);
                }
                .mask-container img {
                    width: 100%; 
                    height: auto;
                    object-fit: cover;
                    position: absolute;
                    transform: translateY(-18%);
                }
                .info-container {
                    margin-top: 420px; /* Ajusta este valor según la imagen para que quede debajo */
                }
                p.names {
                    font-family: 'Pacifico', cursive;
                    font-size: 85px;
                    font-weight: 400;
                }
                .maplibregl-ctrl-bottom-right.mapboxgl-ctrl-bottom-right {
                    display: none;
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div class="mask-container">
                <img src="data:image/png;base64,${processedImageBase64}" alt="Mapa en forma de corazón" />
            </div>
            <div class="info-container">
                <p class="names">${names}</p>
                <p>${location}, ${date}</p>
                <p>${decimalToDMS(lat, true)} ${decimalToDMS(lng, false)}</p>
            </div>
        </body>
        </html>
        `;



        // Crear una nueva página para el PDF dentro del mismo navegador
        const pdfPage = await browser.newPage();
        console.log("Creando una nueva página para el PDF...");

        // Configurar el contenido HTML para el PDF
        await pdfPage.setContent(pdfHtmlContent, { waitUntil: "networkidle0" });
        console.log("Contenido HTML para el PDF configurado.");

        // Generar el PDF
        const pdfFinalPath = path.join(__dirname, "mapa.pdf");
        await pdfPage.pdf({ path: pdfFinalPath, format: "A4" });
        console.log("PDF final generado:", pdfFinalPath);

        // Cerrar la página del PDF
        await pdfPage.close();

        // Cerrar el navegador
        await browser.close();
        console.log("Navegador de Puppeteer cerrado.");

        // Limpiar archivos temporales si lo deseas
        // fs.unlinkSync(mapScreenshotPath);
        // console.log("Archivos temporales eliminados.");

        return pdfFinalPath;
    }

    catch (error) {
        console.error("Error al generar el PDF:", error);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
}

module.exports = { generatePDF };
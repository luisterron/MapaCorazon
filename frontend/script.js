// frontend/script.js
document.addEventListener('DOMContentLoaded', function() {
    const API_KEY = 'BqlojNATD24Jlw23rp6k';
    
    // Inicializar el mapa
    const map = new maplibregl.Map({
        container: 'map',
        style: `https://api.maptiler.com/maps/streets/style.json?key=${API_KEY}`,
        center: [-0.3763, 39.4699], // Valencia por defecto
        zoom: 13
    });

    // Configurar Flatpickr (selector de fecha)
    const fp = flatpickr("#date", {
        dateFormat: "d 'de' MMMM 'de' Y",
        locale: "es",
        allowInput: true,
        altInput: true,
        altFormat: "d 'de' MMMM 'de' Y",
        defaultDate: new Date(),
        parseDate: (datestr) => {
            // Parsing personalizado si es necesario
            return new Date(datestr);
        },
        formatDate: (date) => {
            const day = date.getDate();
            const month = date.toLocaleString('es', { month: 'long' });
            const year = date.getFullYear();
            return `${day} de ${month} de ${year}`;
        }
    });

    // Crear marcador global
    let marker = new maplibregl.Marker({
        draggable: true,
        color: '#ff6b6b'
    });

    // Función para actualizar coordenadas y obtener la ubicación
    async function updateCoordinatesAndLocation(lngLat) {
        const lat = lngLat.lat;
        const lng = lngLat.lng;
    
        // Actualizar inputs de coordenadas
        document.getElementById('lat').value = lat.toFixed(6);
        document.getElementById('lng').value = lng.toFixed(6);
    
        // Actualizar display en DMS
        document.getElementById('latDisplay').textContent = decimalToDMS(lat, true);
        document.getElementById('lngDisplay').textContent = decimalToDMS(lng, false);
    
        // Obtener la ubicación usando la API de geocodificación inversa de MapTiler
        try {
            const response = await fetch(
                `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${API_KEY}`
            );
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                // Buscar específicamente la ciudad en los resultados
                const cityFeature = data.features.find(feature => 
                    feature.place_type && 
                    (feature.place_type.includes('city') || 
                     feature.place_type.includes('municipality') ||
                     feature.place_type.includes('town'))
                );
    
                if (cityFeature) {
                    document.getElementById('location').value = cityFeature.text;
                } else {
                    // Si no encuentra ciudad específica, usar el primer componente administrativo
                    const adminFeature = data.features.find(feature => 
                        feature.place_type && 
                        feature.place_type.includes('region')
                    );
                    document.getElementById('location').value = adminFeature ? adminFeature.text : data.features[0].text;
                }
            }
        } catch (error) {
            console.error('Error al obtener la ubicación:', error);
        }
    }

    // Función para convertir coordenadas decimales a DMS
    function decimalToDMS(decimal, isLatitude) {
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesNotTruncated = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesNotTruncated);
        const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

        const direction = isLatitude 
            ? (decimal >= 0 ? "N" : "S")
            : (decimal >= 0 ? "E" : "W");

        return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
    }

    // Añadir control de búsqueda al mapa
    map.addControl(
        new maplibregl.NavigationControl()
    );

    // Función para actualizar el marcador
    function updateMarker(lngLat) {
        marker
            .setLngLat(lngLat)
            .addTo(map);
        updateCoordinatesAndLocation(lngLat);
    }

    // Eventos del mapa
    map.on('click', (e) => {
        updateMarker(e.lngLat);
    });

    // Evento de arrastre del marcador
    marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        updateCoordinatesAndLocation(lngLat);
    });

    // Esperar a que el mapa se cargue
    map.on('load', () => {
        // Colocar el marcador en la posición inicial
        updateMarker([-0.3763, 39.4699]);

        // Añadir barra de búsqueda
        const geocoder = new maptilersdk.Geocoder({
            input: 'geocoder',
            key: API_KEY
        });

        geocoder.on('select', function(e) {
            const coordinates = e.feature.geometry.coordinates;
            updateMarker({ lng: coordinates[0], lat: coordinates[1] });
            map.flyTo({ center: coordinates, zoom: 14 });
        });
    });

    // Manejar envío del formulario
    document.getElementById('pdfForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const loadingScreen = document.querySelector('.loading');
        loadingScreen.classList.add('active');

        const formData = {
            title: document.getElementById('title').value,
            names: document.getElementById('names').value,
            date: document.getElementById('date').value,
            location: document.getElementById('location').value,
            lat: parseFloat(document.getElementById('lat').value),
            lng: parseFloat(document.getElementById('lng').value)
        };

        try {
            const response = await fetch('/generate-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('Error al generar el PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mapa-romantico.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al generar el PDF. Por favor, intenta de nuevo.');
        } finally {
            loadingScreen.classList.remove('active');
        }
    });
});
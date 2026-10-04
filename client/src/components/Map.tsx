import React from 'react';
import { MapContainer, TileLayer, Polyline, useMap, ZoomControl, CircleMarker } from 'react-leaflet';
import { useStore } from '../store';
import L from 'leaflet';

const defaultCenter: [number, number] = [28.6139, 77.2090]; // Delhi

const MapUpdater: React.FC = () => {
    const map = useMap();
    const { routes, selectedRouteIndex, currentLocation, isNavigating } = useStore();

    React.useEffect(() => {
        if (isNavigating && currentLocation) {
            // Live tracking navigation mode! Follow the user closely.
            map.flyTo([currentLocation.lat, currentLocation.lon], 17, { animate: true, duration: 1 });
        } else if (routes.length > 0 && routes[selectedRouteIndex]) {
            // Overview mode
            const path = routes[selectedRouteIndex].path;
            if (path && path.length > 0) {
                const bounds = L.latLngBounds(path);
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        } else if (currentLocation && routes.length === 0) {
            // Pan to user's location initially if no routes
            map.flyTo([currentLocation.lat, currentLocation.lon], 14, { animate: true, duration: 1 });
        }
    }, [routes, selectedRouteIndex, currentLocation, map]);

    React.useEffect(() => {
        // Ensure native scrollWheelZoom is ENABLED so Leaflet can handle smooth pinch-zooming
        map.scrollWheelZoom.enable();

        const handleWheel = (e: WheelEvent) => {
            // Mac trackpad pinch-to-zoom sends wheel events with ctrlKey=true
            if (e.ctrlKey || e.metaKey) {
                // Let Leaflet's native smooth zoom engine handle this!
                return;
            }
            
            // Standard 2-finger scroll -> Pan the map
            // Stop Leaflet from seeing this event so it doesn't zoom
            e.stopPropagation();
            e.preventDefault();
            
            map.panBy([e.deltaX, e.deltaY], { animate: false });
        };

        const container = map.getContainer();
        // Use capture phase (true) to intercept the event BEFORE Leaflet's handlers get it
        container.addEventListener('wheel', handleWheel, { passive: false, capture: true });

        return () => {
            container.removeEventListener('wheel', handleWheel, { capture: true });
        };
    }, [map]);

    return null;
};

export const Map: React.FC = () => {
    const { routes, selectedRouteIndex, currentLocation, theme } = useStore();
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    
    // Fallback to CartoDB dark/light tiles if Mapbox token is not set
    const mapboxStyle = theme === 'light' ? 'streets-v11' : 'dark-v11';
    const cartoStyle = theme === 'light' ? 'rastertiles/voyager' : 'dark_all';
    
    const tileUrl = mapboxToken && mapboxToken !== 'your_mapbox_token_here' 
        ? `https://api.mapbox.com/styles/v1/mapbox/${mapboxStyle}/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`
        : `https://{s}.basemaps.cartocdn.com/${cartoStyle}/{z}/{x}/{y}{r}.png`;

    return (
        <MapContainer 
            center={defaultCenter} 
            zoom={13} 
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
        >
            <TileLayer
                url={tileUrl}
                attribution='&copy; Mapbox &copy; OpenStreetMap'
            />
            
            {/* Add visible +/- zoom buttons in the bottom left to avoid UI overlaps */}
            <ZoomControl position="bottomleft" />
            
            {/* Current Location Marker (Blue Dot) */}
            {currentLocation && (
                <CircleMarker 
                    center={[currentLocation.lat, currentLocation.lon]} 
                    radius={8} 
                    fillColor="#4285F4" 
                    fillOpacity={1} 
                    color="#ffffff" 
                    weight={3} 
                />
            )}
            
            <MapUpdater />

            {/* Other routes dimmed */}
            {routes.map((route, i) => {
                if (i === selectedRouteIndex) return null;
                return (
                    <Polyline 
                        key={`dimmed-${i}`} 
                        positions={route.path} 
                        color="#555555" 
                        weight={4} 
                    />
                );
            })}

            {/* Selected Route */}
            {routes.length > 0 && routes[selectedRouteIndex] && (
                <Polyline 
                    key="selected"
                    positions={routes[selectedRouteIndex].path} 
                    color="var(--accent-blue)" 
                    weight={6} 
                />
            )}
        </MapContainer>
    );
};

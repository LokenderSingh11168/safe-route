import React, { useState, useEffect } from 'react';
import { Map } from './components/Map';
import { SOSModal } from './components/SOSModal';
import { ContactsModal } from './components/ContactsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { useStore } from './store';
import { AlertTriangle, ShieldCheck, Camera, X, ShieldAlert, Settings, Moon, Sun, LocateFixed } from 'lucide-react';
import { scoreRoute, submitReport } from './api';

const PlaceAutocomplete: React.FC<{
    placeholder: string, 
    value: string, 
    onChange: (val: string) => void, 
    onSelect: (loc: {text: string, lat: number, lon: number}) => void,
    onUseLocation?: () => void
}> = ({ placeholder, value, onChange, onSelect, onUseLocation }) => {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [show, setShow] = useState(false);
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    useEffect(() => {
        if (!value || value.length < 3) {
            setSuggestions([]);
            return;
        }
        const delay = setTimeout(async () => {
            try {
                const photonReq = fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=3&lat=20.5937&lon=78.9629`).then(r => r.json()).catch(() => ({features: []}));
                
                let mapboxReq = Promise.resolve({features: []});
                if (mapboxToken && mapboxToken !== 'your_mapbox_token_here') {
                    mapboxReq = fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${mapboxToken}&limit=3&country=IN`).then(r => r.json()).catch(() => ({features: []}));
                }

                const [photonData, mapboxData] = await Promise.all([photonReq, mapboxReq]);
                
                let merged: any[] = [];
                if (photonData.features) {
                    merged = [...merged, ...photonData.features.map((s: any) => ({
                        title: s.properties.name || s.properties.street || s.properties.city || s.properties.state,
                        subtitle: [s.properties.district, s.properties.city, s.properties.state].filter(Boolean).join(', '),
                        lat: s.geometry.coordinates[1],
                        lon: s.geometry.coordinates[0],
                        source: 'OSM'
                    }))];
                }
                if (mapboxData.features) {
                    merged = [...merged, ...mapboxData.features.map((s: any) => ({
                        title: s.text,
                        subtitle: s.place_name.replace(s.text + ', ', ''),
                        lat: s.center[1],
                        lon: s.center[0],
                        source: 'Mapbox'
                    }))];
                }

                // Simple dedup by title to prevent exact clones
                const unique = merged.filter((v, i, a) => a.findIndex(t => (t.title === v.title)) === i);
                setSuggestions(unique);
            } catch (e) {
                console.error("Autocomplete error:", e);
            }
        }, 300);
        return () => clearTimeout(delay);
    }, [value, mapboxToken]);

    return (
        <div className="autocomplete-wrapper">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                    type="text" 
                    className="input" 
                    placeholder={placeholder} 
                    value={value} 
                    onChange={(e) => {
                        onChange(e.target.value);
                        setShow(true);
                    }} 
                    onFocus={() => setShow(true)}
                    onBlur={() => setTimeout(() => setShow(false), 200)} // delay to allow click
                    style={onUseLocation ? { paddingRight: '40px' } : {}}
                />
                {onUseLocation && (
                    <button 
                        onClick={onUseLocation}
                        title="Use My Location"
                        style={{
                            position: 'absolute',
                            right: '8px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-blue)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px'
                        }}
                    >
                        <LocateFixed size={20} />
                    </button>
                )}
            </div>
            {show && suggestions.length > 0 && (
                <div className="autocomplete-dropdown">
                    {suggestions.map((s: any, i: number) => {
                        return (
                            <div key={i} className="autocomplete-item" onClick={() => {
                                onSelect({
                                    text: s.title + (s.subtitle ? `, ${s.subtitle}` : ''),
                                    lat: s.lat,
                                    lon: s.lon
                                });
                                setShow(false);
                            }}>
                                <div className="autocomplete-item-title">{s.title} <span style={{fontSize:'0.65rem', color:'var(--accent-blue)', marginLeft:'4px'}}>{s.source}</span></div>
                                <div className="autocomplete-item-subtitle">{s.subtitle}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const App: React.FC = () => {
    const { startSosFlow, routes, setRoutes, selectedRouteIndex, setSelectedRouteIndex, currentLocation, setCurrentLocation, isNavigating, setIsNavigating, hasOnboarded, theme, toggleTheme } = useStore();
    
    const [origin, setOrigin] = useState<{text: string, lat?: number, lon?: number}>({text: ''});
    const [dest, setDest] = useState<{text: string, lat?: number, lon?: number}>({text: ''});
    const [loadingRoutes, setLoadingRoutes] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    useEffect(() => {
        let watchId: number;
        if (hasOnboarded && navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const heading = pos.coords.heading; // Direction user is travelling
                    setCurrentLocation({ lat, lon, heading });
                    
                    // Removed forceful overriding of 'My Location' so user can freely type!

                    // If navigating, we could dynamically calculate distance to next step here, 
                    // but for now we just track the location on the map natively.
                },
                (err) => console.error("Could not get location:", err),
                { enableHighAccuracy: true, maximumAge: 0 }
            );
        }
        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [setCurrentLocation, hasOnboarded]);

    const handleSearch = async () => {
        if (!origin.text || !dest.text) return;
        setLoadingRoutes(true);

        try {
            let finalOrigin = { ...origin };
            let finalDest = { ...dest };

            // If they accidentally edited 'My Location' and lost the coordinates, restore them!
            if (finalOrigin.text.trim().toLowerCase() === 'my location' && !finalOrigin.lat && currentLocation) {
                finalOrigin.lat = currentLocation.lat;
                finalOrigin.lon = currentLocation.lon;
            }
            if (finalDest.text.trim().toLowerCase() === 'my location' && !finalDest.lat && currentLocation) {
                finalDest.lat = currentLocation.lat;
                finalDest.lon = currentLocation.lon;
            }

            // If user typed but didn't click dropdown, auto-correct using the top result
            const fetchTopResult = async (query: string) => {
                try {
                    const photonReq = fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lat=20.5937&lon=78.9629`).then(r => r.json()).catch(() => ({features: []}));
                    let mapboxReq = Promise.resolve({features: []});
                    if (mapboxToken && mapboxToken !== 'your_mapbox_token_here') {
                        mapboxReq = fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=1&country=IN`).then(r => r.json()).catch(() => ({features: []}));
                    }
                    
                    const [photonData, mapboxData] = await Promise.all([photonReq, mapboxReq]);
                    
                    if (photonData.features && photonData.features.length > 0) {
                        const s = photonData.features[0];
                        const title = s.properties.name || s.properties.street || s.properties.city || s.properties.state;
                        const subtitle = [s.properties.district, s.properties.city, s.properties.state].filter(Boolean).join(', ');
                        return { text: title + (subtitle ? `, ${subtitle}` : ''), lat: s.geometry.coordinates[1], lon: s.geometry.coordinates[0] };
                    }
                    if (mapboxData.features && mapboxData.features.length > 0) {
                        const s: any = mapboxData.features[0];
                        return { text: s.place_name, lat: s.center[1], lon: s.center[0] };
                    }
                } catch (e) {
                    console.error(e);
                }
                return null;
            };

            if (!finalOrigin.lat) {
                const corrected = await fetchTopResult(finalOrigin.text);
                if (corrected) {
                    finalOrigin = corrected;
                    setOrigin(corrected); // Auto-correct in the search bar
                } else {
                    alert(`Could not find origin: ${finalOrigin.text}`);
                    setLoadingRoutes(false);
                    return;
                }
            }

            if (!finalDest.lat) {
                const corrected = await fetchTopResult(finalDest.text);
                if (corrected) {
                    finalDest = corrected;
                    setDest(corrected); // Auto-correct in the search bar
                } else {
                    alert(`Could not find destination: ${finalDest.text}`);
                    setLoadingRoutes(false);
                    return;
                }
            }

            // Append &steps=true to get turn-by-turn directions
            let routingUrl = `https://router.project-osrm.org/route/v1/driving/${finalOrigin.lon},${finalOrigin.lat};${finalDest.lon},${finalDest.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;
            
            if (mapboxToken && mapboxToken !== 'your_mapbox_token_here') {
                routingUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${finalOrigin.lon},${finalOrigin.lat};${finalDest.lon},${finalDest.lat}?alternatives=true&geometries=geojson&overview=full&steps=true&access_token=${mapboxToken}`;
            }

            const routeRes = await fetch(routingUrl);
            const routeData = await routeRes.json();

            if (routeData.routes && routeData.routes.length > 0) {
                const scoredRoutes = await Promise.all(routeData.routes.map(async (r: any, idx: number) => {
                    const durationSeconds = r.duration || 0;
                    const distanceMeters = r.distance || 0;
                    
                    const coordinates = r.geometry.coordinates;
                    const path = coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
                    
                    const segments = path.filter((_: any, i: number) => i % 5 === 0).map((p: any) => ({ lat: p[0], lng: p[1] }));
                    const polyline = "mock_polyline";
                    const score = await scoreRoute(polyline, durationSeconds, distanceMeters, segments);
                    
                    // Extract turn-by-turn steps
                    let steps = [];
                    if (r.legs && r.legs[0] && r.legs[0].steps) {
                        steps = r.legs[0].steps.map((step: any) => ({
                            instruction: step.maneuver?.instruction || step.name || "Continue straight",
                            distance: step.distance,
                            location: step.maneuver?.location // [lon, lat]
                        }));
                    }

                    return {
                        originalIndex: idx,
                        durationText: Math.round(durationSeconds / 60) + ' min',
                        distanceText: (distanceMeters / 1000).toFixed(1) + ' km',
                        path,
                        score,
                        steps
                    };
                }));
                
                scoredRoutes.sort((a, b) => b.score.safetyScore - a.score.safetyScore);
                setRoutes(scoredRoutes);
                setSelectedRouteIndex(0);
                setIsNavigating(false);
                setActiveStepIndex(0);
            } else {
                alert(`Routing failed: ${routeData.message || routeData.code || 'No route found between these locations.'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Routing failed due to a network error.');
        }
        setLoadingRoutes(false);
    };

    return (
        <div className={`app-container ${theme === 'light' ? 'light-mode' : ''}`}>
            <Map />
            
            {/* Navigation Mode Banner */}
            {isNavigating && routes.length > 0 && routes[selectedRouteIndex] && (
                <div className="absolute top-4 left-1/2" style={{ transform: 'translateX(-50%)', zIndex: 9999, width: '90%', maxWidth: '600px' }}>
                    <div className="panel p-4 flex flex-col gap-2" style={{ backgroundColor: 'var(--safe-green)', color: 'black' }}>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xl uppercase tracking-wider">
                                {routes[selectedRouteIndex].steps[activeStepIndex]?.instruction || 'Follow Route'}
                            </span>
                            <button 
                                className="btn" 
                                style={{ backgroundColor: 'rgba(0,0,0,0.1)', color: 'black', border: 'none' }}
                                onClick={() => setIsNavigating(false)}
                            >
                                <X size={20} /> Exit
                            </button>
                        </div>
                        <div className="flex justify-between items-center font-bold">
                            <span>
                                {routes[selectedRouteIndex].steps[activeStepIndex]?.distance ? Math.round(routes[selectedRouteIndex].steps[activeStepIndex].distance) + 'm' : ''}
                            </span>
                            <span className="opacity-70 text-sm">
                                {routes[selectedRouteIndex].durationText} • {routes[selectedRouteIndex].distanceText} left
                            </span>
                        </div>
                        
                        {/* Simulation controls to step through directions */}
                        <div className="flex justify-center mt-2 gap-2">
                            <button className="btn" style={{backgroundColor:'rgba(0,0,0,0.2)', border:'none', color:'black'}} disabled={activeStepIndex === 0} onClick={() => setActiveStepIndex(a => a - 1)}>Prev Step</button>
                            <button className="btn" style={{backgroundColor:'rgba(0,0,0,0.2)', border:'none', color:'black'}} disabled={activeStepIndex >= routes[selectedRouteIndex].steps.length - 1} onClick={() => setActiveStepIndex(a => a + 1)}>Next Step</button>
                        </div>
                    </div>
                </div>
            )}

            {!isNavigating && (
                <div className="top-left-panel">
                    <div className="panel p-3">
                    <div className="flex justify-between items-center mb-3">
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <ShieldCheck color="var(--safe-green)" /> SafePath AI
                        </h1>
                        <div className="flex gap-2">
                            <button 
                                className="btn bg-transparent p-1 border-none hover:bg-[rgba(128,128,128,0.2)] rounded-full transition-colors"
                                onClick={toggleTheme}
                                title="Toggle Theme"
                            >
                                {theme === 'light' ? <Moon size={20} color="var(--text-primary)" /> : <Sun size={20} color="var(--text-primary)" />}
                            </button>
                            <button 
                                className="btn bg-transparent p-1 border-none hover:bg-[rgba(128,128,128,0.2)] rounded-full transition-colors"
                                onClick={() => useStore.setState({ isContactsModalOpen: true })}
                                title="Emergency Contacts"
                            >
                                <Settings size={20} color="var(--text-primary)" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <PlaceAutocomplete 
                            placeholder="Origin (e.g. Connaught Place)" 
                            value={origin.text} 
                            onChange={(text) => setOrigin({ text })}
                            onSelect={(loc) => setOrigin(loc)}
                            onUseLocation={currentLocation ? () => setOrigin({ text: 'My Current Location', lat: currentLocation.lat, lon: currentLocation.lon }) : undefined}
                        />
                        <PlaceAutocomplete 
                            placeholder="Destination (e.g. India Gate)" 
                            value={dest.text} 
                            onChange={(text) => setDest({ text })}
                            onSelect={(loc) => setDest(loc)}
                        />
                        <button className="btn btn-primary" onClick={handleSearch} disabled={loadingRoutes}>
                            {loadingRoutes ? 'Calculating...' : 'Find Safe Route'}
                        </button>
                    </div>
                </div>

                {routes.length > 0 && (
                    <div className="panel p-3 flex flex-col gap-3" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                        <h2 className="text-lg font-bold">Recommended Routes</h2>
                        
                        {routes.map((r, i) => (
                            <div 
                                key={i} 
                                className="panel p-2 flex flex-col gap-1 cursor-pointer" 
                                style={{ 
                                    borderColor: i === selectedRouteIndex ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                                    backgroundColor: i === selectedRouteIndex ? 'rgba(66, 133, 244, 0.1)' : 'var(--surface-color)'
                                }}
                                onClick={() => setSelectedRouteIndex(i)}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold">{r.durationText}</span>
                                    <span className="text-sm px-2 py-1" style={{ 
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: r.score.riskLevel === 'Low' ? 'var(--safe-green)' : (r.score.riskLevel === 'Medium' ? 'var(--caution-amber)' : 'var(--danger-red)'),
                                        color: '#000', fontWeight: 'bold'
                                    }}>
                                        Score: {r.score.safetyScore}
                                    </span>
                                </div>
                                <div className="text-sm text-muted">
                                    {r.distanceText} • {r.score.riskLevel} Risk
                                </div>
                                {i === selectedRouteIndex && r.score.flaggedSegments.length > 0 && (
                                    <div className="text-sm mt-2" style={{ color: 'var(--caution-amber)' }}>
                                        <AlertTriangle size={14} style={{ display: 'inline' }} /> 
                                        Avoids {r.score.flaggedSegments.length} flagged segments
                                    </div>
                                )}
                                {i === selectedRouteIndex && (
                                    <button 
                                        className="btn btn-primary mt-2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsNavigating(true);
                                            setActiveStepIndex(0);
                                        }}
                                    >
                                        Start Navigation
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            )}
            
            {/* Universal SOS Button - Center Bottom */}
            <div className="absolute bottom-10 left-1/2" style={{ transform: 'translateX(-50%)', zIndex: 10000 }}>
                <button 
                    className="sos-btn flex items-center justify-center gap-2 shadow-lg"
                    style={{ width: 'auto', padding: '16px 32px', borderRadius: '32px' }}
                    onClick={startSosFlow}
                    aria-label="Emergency SOS"
                >
                    <ShieldAlert size={28} />
                    <span className="text-xl tracking-wide uppercase">SOS</span>
                </button>
            </div>

            <div className="bottom-right-panel">
                <button 
                    className="btn shadow-lg" 
                    style={{ borderRadius: 'var(--radius-full)', width: '56px', height: '56px', backgroundColor: 'var(--surface-color)', color: 'var(--text-color)' }}
                    onClick={() => useStore.setState({ isReportModalOpen: true })}
                    title="Report Hazard"
                >
                    <AlertTriangle size={24} />
                </button>
            </div>

            <SOSModal />
            <ReportModal />
            <ContactsModal />
            <OnboardingModal />
        </div>
    );
};

const ReportModal: React.FC = () => {
    const { isReportModalOpen, setReportModalOpen } = useStore();
    const [file, setFile] = useState<File | null>(null);
    const [type, setType] = useState('pothole');
    const [severity, setSeverity] = useState(3);
    const [note, setNote] = useState('');
    const [status, setStatus] = useState('');

    if (!isReportModalOpen) return null;

    const handleSubmit = async () => {
        setStatus('Submitting...');
        
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const formData = new FormData();
                formData.append('type', type);
                formData.append('severity', severity.toString());
                formData.append('note', note);
                formData.append('lat', pos.coords.latitude.toString());
                formData.append('lng', pos.coords.longitude.toString());
                if (file) {
                    formData.append('photo', file);
                }
                
                try {
                    await submitReport(formData);
                    setStatus('Report submitted successfully! (Pending verification)');
                    setTimeout(() => {
                        setReportModalOpen(false);
                        setStatus('');
                    }, 2000);
                } catch (e) {
                    setStatus('Failed to submit');
                }
            },
            (_err) => {
                setStatus('Location required to submit report.');
            }
        );
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold flex items-center gap-2"><AlertTriangle /> Report Hazard</h2>
                    <button onClick={() => setReportModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                </div>
                
                <div className="flex flex-col gap-3">
                    <label>
                        Condition Type
                        <select className="input mt-1" value={type} onChange={e => setType(e.target.value)}>
                            <option value="pothole">Pothole</option>
                            <option value="flooding">Flooding</option>
                            <option value="poor_lighting">Poor Lighting</option>
                            <option value="construction">Construction</option>
                        </select>
                    </label>
                    
                    <label>
                        Severity (1-5)
                        <input type="range" min="1" max="5" value={severity} onChange={e => setSeverity(parseInt(e.target.value))} style={{ width: '100%', marginTop: '8px' }} />
                        <div className="text-center">{severity}</div>
                    </label>

                    <label>
                        Photo (Optional)
                        <div className="input mt-1 flex items-center justify-center gap-2" style={{ borderStyle: 'dashed', height: '60px', cursor: 'pointer' }}>
                            <Camera /> {file ? file.name : 'Tap to upload'}
                            <input type="file" style={{ display: 'none' }} accept="image/jpeg, image/png, image/webp" onChange={e => setFile(e.target.files?.[0] || null)} />
                        </div>
                    </label>

                    <label>
                        Note
                        <textarea className="input mt-1" rows={3} value={note} onChange={e => setNote(e.target.value)}></textarea>
                    </label>
                    
                    {status && <div className="text-sm text-center font-bold" style={{ color: status.includes('Failed') ? 'var(--danger-red)' : 'var(--safe-green)' }}>{status}</div>}
                    
                    <button className="btn btn-primary" onClick={handleSubmit}>Submit Report</button>
                </div>
            </div>
        </div>
    );
};
export default App;

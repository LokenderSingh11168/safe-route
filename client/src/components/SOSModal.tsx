import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { X, Phone, ShieldAlert, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';

export const SOSModal: React.FC = () => {
    const { sosActive, emergencyContacts, cancelSosFlow, setContactsModalOpen } = useStore();
    const [isProcessingSOS, setIsProcessingSOS] = useState(false);
    const [sosStateMsg, setSosStateMsg] = useState<string | null>(null);
    const [showFallbackUI, setShowFallbackUI] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [emergencyMessage, setEmergencyMessage] = useState<string>("");

    // Reset state when modal closes
    useEffect(() => {
        if (!sosActive) {
            setIsProcessingSOS(false);
            setSosStateMsg(null);
            setShowFallbackUI(false);
            setGeneratedUrl(null);
            setEmergencyMessage("");
        } else if (sosActive && emergencyContacts.length === 0) {
            cancelSosFlow();
            setContactsModalOpen(true);
        }
    }, [sosActive, emergencyContacts, cancelSosFlow, setContactsModalOpen]);

    if (!sosActive) return null;

    const handleCallNow = async () => {
        setIsProcessingSOS(true);
        setSosStateMsg("Obtaining your current location...");

        let lat = 0, lon = 0;
        let locError = null;

        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
        } catch (e: any) {
            locError = e;
            if (e.code === e.PERMISSION_DENIED) {
                setSosStateMsg("Location permission was denied. The emergency call will still be attempted.");
            } else if (e.code === e.TIMEOUT) {
                setSosStateMsg("Unable to get your current location. The emergency call will still be attempted.");
            } else {
                setSosStateMsg("Your current location could not be determined.");
            }
            // Give user time to read the message if there was an error
            await new Promise(r => setTimeout(r, 2000));
        }

        const locationUrl = locError ? null : `https://www.google.com/maps?q=${lat},${lon}`;
        if (locationUrl) setGeneratedUrl(locationUrl);
        
        const msg = locationUrl 
            ? `🚨 Emergency! I need help. My current location is: ${locationUrl}` 
            : `🚨 Emergency! I need help. (Location could not be determined)`;
        
        setEmergencyMessage(msg);

        const phone = emergencyContacts[0];
        if (!phone) {
            setSosStateMsg("No emergency contact configured!");
            setTimeout(cancelSosFlow, 2000);
            return;
        }

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
            setSosStateMsg("Initiating call...");
            // Initiate phone call natively
            window.location.href = `tel:${phone}`;
            
            // Wait slightly before attempting share API
            setTimeout(async () => {
                setSosStateMsg("Preparing location sharing...");
                // Web Share API
                if (navigator.share && navigator.canShare && navigator.canShare({ text: msg })) {
                    try {
                        await navigator.share({
                            title: "Emergency Location",
                            text: msg
                        });
                        cancelSosFlow();
                    } catch (err) {
                        // User likely cancelled native share, totally fine
                        cancelSosFlow();
                    }
                } else {
                    // Fallback to WhatsApp URI if Web Share is not supported
                    window.location.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                    cancelSosFlow();
                }
            }, 1500);
        } else {
            // Desktop Graceful Fallback
            setSosStateMsg("Calling is not supported on this device.");
            setShowFallbackUI(true);
            setIsProcessingSOS(false);
        }
    };

    return (
        <div className="modal-overlay">
            <motion.div 
                className="modal-content"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
                <div className="flex flex-col items-center gap-3 w-full">
                    <ShieldAlert size={64} color="var(--danger-red)" className="animate-pulse" />
                    <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--danger-red)' }}>🚨 EMERGENCY SOS</h2>
                    
                    {!showFallbackUI && !isProcessingSOS && (
                        <>
                            <p className="text-center my-2 text-lg">
                                Are you sure you want to initiate an emergency call?<br/>
                                Your current location will also be prepared for sharing.
                            </p>
                            <div className="flex gap-4 w-full mt-4">
                                <button className="btn flex-1 bg-[var(--surface-elevated)]" onClick={cancelSosFlow}>
                                    CANCEL
                                </button>
                                <button className="btn btn-danger flex-1" onClick={handleCallNow}>
                                    CALL NOW
                                </button>
                            </div>
                        </>
                    )}

                    {isProcessingSOS && (
                        <p className="text-center my-4 font-bold text-lg">
                            {sosStateMsg || "Preparing emergency workflow..."}
                        </p>
                    )}

                    {showFallbackUI && (
                        <div className="w-full flex flex-col gap-3 mt-4">
                            <p className="text-center font-bold text-[var(--caution-amber)]">
                                {sosStateMsg}
                            </p>
                            
                            <div className="text-center text-xl tracking-widest font-mono font-bold bg-[rgba(255,255,255,0.05)] p-3 rounded">
                                {emergencyContacts[0]}
                            </div>
                            
                            <div className="flex gap-2 flex-wrap justify-center mt-2">
                                <button className="btn bg-[rgba(255,255,255,0.1)] border-none flex-1" onClick={() => {
                                    if (navigator.clipboard) {
                                        navigator.clipboard.writeText(emergencyContacts[0] || "");
                                        alert("Number copied!");
                                    }
                                }}>
                                    <Phone size={16} /> Copy Number
                                </button>

                                {generatedUrl && (
                                    <>
                                        <button className="btn bg-[rgba(255,255,255,0.1)] border-none flex-1" onClick={() => {
                                            if (navigator.clipboard) {
                                                navigator.clipboard.writeText(emergencyMessage);
                                                alert("Location copied!");
                                            }
                                        }}>
                                            Copy Location
                                        </button>
                                        <button className="btn bg-[rgba(255,255,255,0.1)] border-none flex-1" onClick={() => {
                                            window.open(generatedUrl, '_blank');
                                        }}>
                                            <Navigation size={16} /> Open Map
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            <button className="btn mt-2 border-none font-bold" style={{ backgroundColor: '#25D366', color: 'white', width: '100%', height: '48px' }} onClick={() => {
                                window.open(`https://wa.me/?text=${encodeURIComponent(emergencyMessage)}`, '_blank');
                            }}>
                                Share Location to WhatsApp
                            </button>

                            <button className="btn btn-danger mt-4" style={{ width: '100%', height: '48px' }} onClick={cancelSosFlow}>
                                <X size={20} /> Close
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

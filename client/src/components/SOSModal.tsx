import React, { useEffect } from 'react';
import { useStore } from '../store';
import { X, Phone, ShieldAlert, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';

export const SOSModal: React.FC = () => {
    const { sosActive, emergencyContacts, cancelSosFlow, currentLocation, setContactsModalOpen } = useStore();

    const generateMapsUrl = () => {
        if (currentLocation) {
            return `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lon}`;
        }
        return 'Location not available yet.';
    };

    useEffect(() => {
        if (sosActive && emergencyContacts.length === 0) {
            // If they have no contacts, prompt them!
            cancelSosFlow();
            setContactsModalOpen(true);
        }
    }, [sosActive]); // We deliberately only want this to run when sosActive toggles

    if (!sosActive) return null;

    const generateWhatsAppLink = (phone: string) => {
        const text = `🚨 EMERGENCY SOS! I need help immediately. Here is my live location: ${generateMapsUrl()}`;
        return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
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
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--danger-red)' }}>Emergency SOS Active</h2>
                    
                    <p className="text-center font-bold my-2">
                        Calling your emergency contacts...
                    </p>

                    <div className="w-full flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                        {emergencyContacts.map((contact, i) => (
                            <div key={i} className="flex flex-col gap-2 p-3 bg-[rgba(255,255,255,0.05)] rounded-lg">
                                <div className="font-bold text-sm">Emergency Contact {i + 1}</div>
                                <div className="text-lg tracking-wider font-mono">{contact}</div>
                                <div className="flex gap-2 mt-1">
                                    <a href={`tel:${contact}`} className="btn flex-1 bg-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.2)] border-none">
                                        <Phone size={18} /> Call
                                    </a>
                                    <a 
                                        href={generateWhatsAppLink(contact)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="btn flex-1 border-none text-white font-bold"
                                        style={{ backgroundColor: '#25D366' }}
                                    >
                                        <Navigation size={18} /> WhatsApp
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ width: '100%', marginTop: '16px' }}>
                        <button className="btn btn-danger" style={{ width: '100%', height: '56px', fontSize: '1.25rem' }} onClick={cancelSosFlow}>
                            <X size={24} /> Close SOS Panel
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

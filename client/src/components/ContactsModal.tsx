import React, { useState } from 'react';
import { useStore } from '../store';
import { X, Users, Save, Phone } from 'lucide-react';

export const ContactsModal: React.FC = () => {
    const { isContactsModalOpen, setContactsModalOpen, emergencyContacts, setEmergencyContacts } = useStore();
    
    // Local state for the 5 inputs
    const [contacts, setContacts] = useState<string[]>([...emergencyContacts, '', '', '', '', ''].slice(0, 5));

    if (!isContactsModalOpen) return null;

    const handleSave = () => {
        // Filter out empty strings
        const valid = contacts.map(c => c.trim()).filter(Boolean);
        setEmergencyContacts(valid);
        setContactsModalOpen(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content relative max-w-sm w-full">
                <button 
                    className="absolute top-4 right-4"
                    onClick={() => setContactsModalOpen(false)}
                >
                    <X size={24} />
                </button>
                
                <div className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Users /> Emergency Contacts
                    </h2>
                    <p className="text-sm text-muted">
                        Add up to 5 mobile numbers. When you press SOS, these contacts will be called directly and your live location will be shared with them on WhatsApp.
                    </p>

                    <div className="flex flex-col gap-3">
                        {contacts.map((contact, i) => (
                            <label key={i} className="flex flex-col text-sm font-bold">
                                Contact {i + 1}
                                <div className="flex items-center bg-[rgba(255,255,255,0.05)] rounded-lg mt-1 px-3">
                                    <Phone size={16} className="opacity-50" />
                                    <input 
                                        type="tel"
                                        placeholder="e.g. +91 9876543210"
                                        className="input bg-transparent border-none focus:outline-none flex-1 ml-2 py-3"
                                        value={contact}
                                        onChange={(e) => {
                                            const newC = [...contacts];
                                            newC[i] = e.target.value;
                                            setContacts(newC);
                                        }}
                                    />
                                </div>
                            </label>
                        ))}
                    </div>

                    <button className="btn btn-primary mt-2 flex items-center justify-center gap-2" onClick={handleSave}>
                        <Save size={20} /> Save Contacts
                    </button>
                </div>
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { ShieldCheck, MapPin, Users, CheckCircle } from 'lucide-react';
import { useStore } from '../store';

export const OnboardingModal: React.FC = () => {
    const { setContactsModalOpen, hasOnboarded, setHasOnboarded } = useStore();
    const [step, setStep] = useState(0);

    if (hasOnboarded) return null;

    const handleGrantLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                () => {
                    // Success!
                    setStep(1);
                },
                (_err) => {
                    alert("Location access was denied. The app cannot function correctly without it.");
                    // Let them proceed anyway or retry, we'll just advance to contacts setup for now
                    setStep(1);
                }
            );
        } else {
            setStep(1);
        }
    };

    const handleFinish = () => {
        setHasOnboarded(true);
        // Prompt them to add contacts immediately
        setContactsModalOpen(true);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content relative max-w-sm w-full p-6 text-center flex flex-col items-center gap-4">
                <ShieldCheck size={64} color="var(--safe-green)" />
                <h2 className="text-2xl font-bold">Welcome to SafePath</h2>
                
                {step === 0 && (
                    <>
                        <p className="text-muted text-sm">
                            To guide you through safe routes and share your live location with emergency contacts in case of danger, SafePath needs background location access.
                        </p>
                        <div className="flex flex-col gap-3 w-full mt-4">
                            <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.05)] p-3 rounded-lg text-left">
                                <MapPin size={24} color="var(--accent-blue)" />
                                <span className="text-sm">Continuous live tracking for navigation</span>
                            </div>
                            <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.05)] p-3 rounded-lg text-left">
                                <Users size={24} color="var(--danger-red)" />
                                <span className="text-sm">Share exact coordinates on SOS</span>
                            </div>
                        </div>
                        <button className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2" onClick={handleGrantLocation}>
                            <MapPin size={20} /> Grant Location Access
                        </button>
                    </>
                )}

                {step === 1 && (
                    <>
                        <CheckCircle size={48} color="var(--safe-green)" />
                        <p className="text-muted text-sm">
                            Location permission granted. Now, let's set up your emergency contacts so they can be reached instantly when you press the SOS button.
                        </p>
                        <button className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2" onClick={handleFinish}>
                            <Users size={20} /> Setup Contacts
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

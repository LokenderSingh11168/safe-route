import { create } from 'zustand';
import { startSos, updateSosLocation, cancelSos, getSosState } from './api';

interface AppState {
    // Routing State
    routes: any[];
    selectedRouteIndex: number;
    setRoutes: (routes: any[]) => void;
    setSelectedRouteIndex: (idx: number) => void;

    // SOS State
    sosActive: boolean;
    sosSession: any | null;
    emergencyContacts: string[];
    setEmergencyContacts: (contacts: string[]) => void;
    startSosFlow: () => Promise<void>;
    cancelSosFlow: () => Promise<void>;
    pollSosState: () => Promise<void>;
    
    // User Location & Navigation
    currentLocation: { lat: number, lon: number, heading?: number | null } | null;
    setCurrentLocation: (loc: { lat: number, lon: number, heading?: number | null }) => void;
    isNavigating: boolean;
    setIsNavigating: (val: boolean) => void;
    
    // UI State
    isReportModalOpen: boolean;
    setReportModalOpen: (open: boolean) => void;
    isContactsModalOpen: boolean;
    setContactsModalOpen: (open: boolean) => void;
    hasOnboarded: boolean;
    setHasOnboarded: (val: boolean) => void;
    theme: 'dark' | 'light';
    toggleTheme: () => void;
}

export const useStore = create<AppState>((set, get) => ({
    routes: [],
    selectedRouteIndex: 0,
    setRoutes: (routes) => set({ routes }),
    setSelectedRouteIndex: (selectedRouteIndex) => set({ selectedRouteIndex }),
    
    currentLocation: null,
    setCurrentLocation: (currentLocation) => set({ currentLocation }),
    
    isNavigating: false,
    setIsNavigating: (isNavigating) => set({ isNavigating }),
    
    sosActive: false,
    sosSession: null,
    emergencyContacts: JSON.parse(localStorage.getItem('safepath_contacts') || '[]'),
    setEmergencyContacts: (contacts) => {
        localStorage.setItem('safepath_contacts', JSON.stringify(contacts));
        set({ emergencyContacts: contacts });
    },
    
    startSosFlow: async () => {
        set({ sosActive: true, sosSession: null });
        try {
            const session = await startSos();
            
            if (!get().sosActive) {
                // User cancelled while API was pending
                await cancelSos(session.sessionId);
                return;
            }
            
            set({ sosSession: session });
            
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    if (!get().sosActive) return;
                    
                    const updated = await updateSosLocation(
                        session.sessionId,
                        pos.coords.latitude,
                        pos.coords.longitude,
                        pos.coords.accuracy
                    );
                    
                    if (get().sosActive) {
                        set({ sosSession: updated });
                    }
                },
                (err) => {
                    console.error('Location error:', err);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } catch (e) {
            console.error('Failed to start SOS', e);
            set({ sosActive: false });
        }
    },
    cancelSosFlow: async () => {
        const { sosSession } = get();
        
        // Immediately hide the modal to give instant feedback
        set({ sosActive: false });
        
        if (sosSession?.sessionId) {
            try {
                const updated = await cancelSos(sosSession.sessionId);
                set({ sosSession: updated });
            } catch (e) {
                console.error("Failed to cancel SOS on backend:", e);
                set({ sosSession: null });
            }
        } else {
            // If they clicked cancel before the session even initialized
            set({ sosSession: null });
        }
    },
    pollSosState: async () => {
        const { sosSession, sosActive } = get();
        if (sosActive && sosSession?.sessionId && sosSession.status !== 'cancelled' && sosSession.status !== 'connected' && sosSession.status !== 'exhausted_failed') {
            const updated = await getSosState(sosSession.sessionId);
            set({ sosSession: updated });
        }
    },
    
    isReportModalOpen: false,
    setReportModalOpen: (open) => set({ isReportModalOpen: open }),
    
    isContactsModalOpen: false,
    setContactsModalOpen: (open) => set({ isContactsModalOpen: open }),
    
    hasOnboarded: localStorage.getItem('safepath_onboarded') === 'true',
    setHasOnboarded: (val) => {
        localStorage.setItem('safepath_onboarded', val ? 'true' : 'false');
        set({ hasOnboarded: val });
    },
    
    theme: (localStorage.getItem('safepath_theme') as 'dark' | 'light') || 'dark',
    toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('safepath_theme', newTheme);
        set({ theme: newTheme });
    }
}));

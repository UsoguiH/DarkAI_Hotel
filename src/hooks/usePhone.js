import { create } from 'zustand';

const usePhone = create((set) => ({
    isOpen: false,
    setDarkTherapistOpen: (value) => set({ isOpen: value }),
}));

export default usePhone;

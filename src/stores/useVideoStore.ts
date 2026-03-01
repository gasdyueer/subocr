import { create } from 'zustand';
import { CropRect } from '../types';

interface VideoState {
  file: File | null;
  videoUrl: string | null;
  duration: number;
  currentTime: number;
  cropRect: CropRect; // Percentages: x, y, width, height (0-100)
  videoDimensions: { width: number; height: number };

  setFile: (file: File) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setCropRect: (rect: CropRect) => void;
  setVideoDimensions: (width: number, height: number) => void;
  reset: () => void;
  switchVideo: (file: File) => void;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  file: null,
  videoUrl: null,
  duration: 0,
  currentTime: 0,
  cropRect: { x: 10, y: 80, width: 80, height: 15 }, // Default bottom area
  videoDimensions: { width: 0, height: 0 },

  setFile: (file) => {
    const currentUrl = get().videoUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    const url = URL.createObjectURL(file);
    set({ file, videoUrl: url, currentTime: 0, duration: 0 });
  },
  setDuration: (duration) => set({ duration }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setCropRect: (cropRect) => set({ cropRect }),
  setVideoDimensions: (width, height) => set({ videoDimensions: { width, height } }),
  reset: () => {
    const currentUrl = get().videoUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    set({ file: null, videoUrl: null, duration: 0, currentTime: 0 });
  },
  switchVideo: (file) => {
    const currentUrl = get().videoUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    const url = URL.createObjectURL(file);
    set({ file, videoUrl: url, currentTime: 0, duration: 0 });
  },
}));

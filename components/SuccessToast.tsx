"use client";

import { useEffect } from 'react';

interface SuccessToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function SuccessToast({ message, onClose, duration = 3000 }: SuccessToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
        <span className="text-xl">✓</span>
        <p className="flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
    </div>
  );
}


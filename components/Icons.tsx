
import React from 'react';

interface IconProps {
  className?: string;
}

export const WhatsAppIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={`w-6 h-6 ${className}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.31 20.6C8.75 21.42 10.36 21.89 12.04 21.89C17.5 21.89 21.95 17.44 21.95 11.98C21.95 9.32 20.92 6.84 19.09 4.98C17.23 3.14 14.75 2.09 12.04 2.09V2M12.04 20.13C10.56 20.13 9.11 19.7 7.85 18.9L7.5 18.71L4.56 19.54L5.4 16.7L5.2 16.35C4.38 15.03 4 13.5 4 11.91C4 7.42 7.59 3.83 12.04 3.83C14.22 3.83 16.22 4.68 17.79 6.25C19.36 7.82 20.15 9.87 20.15 11.98C20.15 16.47 16.56 20.13 12.04 20.13M17.27 14.45C17.03 14.33 15.91 13.8 15.68 13.7C15.45 13.61 15.28 13.56 15.11 13.8C14.94 14.04 14.46 14.6 14.33 14.76C14.2 14.91 14.07 14.94 13.84 14.82C13.61 14.7 12.89 14.44 11.98 13.62C11.27 12.98 10.83 12.26 10.71 12.02C10.59 11.78 10.72 11.66 10.84 11.53C10.95 11.41 11.08 11.23 11.21 11.08C11.34 10.94 11.37 10.84 11.47 10.65C11.57 10.45 11.52 10.28 11.45 10.16C11.38 10.04 10.89 8.81 10.69 8.31C10.49 7.82 10.28 7.87 10.12 7.87C9.96 7.87 9.79 7.87 9.62 7.87C9.45 7.87 9.19 7.94 8.97 8.18C8.76 8.42 8.23 8.91 8.23 10.03C8.23 11.15 9.01 12.21 9.13 12.37C9.26 12.53 10.88 15.01 13.33 16.03C15.78 17.06 15.78 16.7 16.23 16.65C16.68 16.6 17.59 16.03 17.78 15.44C17.97 14.85 17.97 14.35 17.9 14.25C17.83 14.15 17.5 14.58 17.27 14.45Z" />
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={`w-6 h-6 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={`w-6 h-6 text-gray-500 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
);

export const LinkIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={`w-6 h-6 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
);

export const PaperAirplaneIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={`w-6 h-6 transform rotate-45 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={`w-6 h-6 text-teal-600 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414L10 17l-4 4 4-4 6.293-6.293a1 1 0 011.414 0L21 12m-4-4l-2.293-2.293a1 1 0 00-1.414 0L9 10l4 4 4-4z"></path></svg>
);


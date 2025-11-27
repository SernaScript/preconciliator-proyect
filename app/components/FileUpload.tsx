'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  label: string;
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
}

export default function FileUpload({ label, accept, file, onFileChange, error }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileChange(acceptedFiles[0]);
    }
  }, [onFileChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept === '.csv' ? { 'text/csv': ['.csv'] } : { 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer
          ${isDragActive || isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
          ${file ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center">
          {file ? (
            <>
              <svg
                className="w-12 h-12 text-green-500 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                {file.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {(file.size / 1024).toFixed(2)} KB
              </p>
              <button
                onClick={handleRemove}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
              >
                Eliminar archivo
              </button>
            </>
          ) : (
            <>
              <svg
                className="w-12 h-12 text-gray-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {isDragActive
                  ? 'Suelta el archivo aquí'
                  : 'Arrastra y suelta el archivo aquí, o haz clic para seleccionar'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {accept === '.csv' ? 'CSV' : 'Excel (.xlsx, .xls)'}
              </p>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}


import React, { useCallback } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import { Upload, FileVideo } from 'lucide-react';
import { useVideoStore } from '../../stores/useVideoStore';
import { cn } from '../../lib/utils';

export function VideoUploader() {
  const setFile = useVideoStore((state) => state.setFile);
  const videoFile = useVideoStore((state) => state.file);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, [setFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mkv', '.mov', '.webm']
    },
    multiple: false
  } as unknown as DropzoneOptions);

  if (videoFile) return null;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors h-full min-h-[400px]",
        isDragActive 
          ? "border-blue-500 bg-blue-50/10" 
          : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"
      )}
    >
      <input {...getInputProps()} />
      <div className="bg-zinc-800 p-4 rounded-full mb-4">
        <Upload className="w-8 h-8 text-zinc-400" />
      </div>
      <h3 className="text-xl font-semibold mb-2 text-zinc-100">
        {isDragActive ? "Drop the video here" : "Upload Video"}
      </h3>
      <p className="text-zinc-400 max-w-sm">
        Drag and drop your video file here, or click to browse.
        Supports MP4, MKV, MOV, WebM.
      </p>
    </div>
  );
}

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import imageCompression from 'browser-image-compression';
import { IMAGE_COMPRESSION_OPTIONS } from '@/constants/cube';

export function useImageUpload() {
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File, index: number): Promise<string> => {
    setCompressing(true);
    let fileToUpload = file;

    try {
      const compressedFile = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
      fileToUpload = new File([compressedFile], file.name, { type: compressedFile.type });
    } catch (error) {
      console.error('Image compression failed:', error);
    } finally {
      setCompressing(false);
    }

    setUploading(true);
    try {
      const fileExt = fileToUpload.type.split('/')[1] || 'jpg';
      const fileName = `${Math.random().toString(36).substring(2)}_${index}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cube-images')
        .upload(filePath, fileToUpload);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cube-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      throw new Error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return { uploadFile, compressing, uploading };
}


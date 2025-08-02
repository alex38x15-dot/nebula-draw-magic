-- Create storage buckets for generated images
INSERT INTO storage.buckets (id, name, public) VALUES ('public-images', 'public-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('private-images', 'private-images', false);

-- Create table for generated image records
CREATE TABLE public.generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Create policies for generated_images table
CREATE POLICY "Users can view their own images" 
ON public.generated_images 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view public images" 
ON public.generated_images 
FOR SELECT 
USING (is_public = true);

CREATE POLICY "Users can create their own images" 
ON public.generated_images 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own images" 
ON public.generated_images 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own images" 
ON public.generated_images 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for public images storage bucket
CREATE POLICY "Public images are accessible to everyone" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'public-images');

CREATE POLICY "Users can upload to public images bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'public-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own public images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'public-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own public images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'public-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policies for private images storage bucket
CREATE POLICY "Users can view their own private images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'private-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload to private images bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'private-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own private images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'private-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own private images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'private-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_generated_images_updated_at
BEFORE UPDATE ON public.generated_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
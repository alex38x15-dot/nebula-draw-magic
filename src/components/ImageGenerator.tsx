import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const ImageGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a prompt to generate an image."
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedImage(data.imageUrl);
      setRevisedPrompt(data.revisedPrompt);
      
      toast({
        title: "Success",
        description: "Image generated successfully!"
      });
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate image. Please try again."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Describe the image you want to generate
          </label>
          <Textarea
            placeholder="A beautiful sunset over a calm ocean with sailboats in the distance..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="mt-1"
            rows={3}
          />
        </div>
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Image'}
        </Button>
      </div>

      {isGenerating && (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="w-full h-64 rounded-lg" />
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Generating your image...
            </p>
          </CardContent>
        </Card>
      )}

      {generatedImage && !isGenerating && (
        <Card>
          <CardContent className="p-6">
            <img 
              src={generatedImage} 
              alt="Generated image"
              className="w-full rounded-lg shadow-md"
            />
            {revisedPrompt && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Revised prompt:</strong> {revisedPrompt}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const googleAIApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!googleAIApiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { prompt, isPublic = false } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Generating image with prompt:', prompt, 'isPublic:', isPublic, 'User ID:', user.id);

    // Initialize GoogleGenAI client
    const ai = new GoogleGenAI({ apiKey: googleAIApiKey });

    // Generate image using GoogleGenAI client
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        responseMimeType: "image/jpeg"
      }
    });

    console.log('Image generation successful');

    // Extract the base64 image from the response
    const imageData = response.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!imageData) {
      throw new Error('No image data received from Gemini');
    }

    // Convert base64 to binary
    const imageBuffer = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    
    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${user.id}/${timestamp}-generated.jpg`;
    const bucketId = isPublic ? 'public-images' : 'private-images';

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketId)
      .upload(filename, imageBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error('Failed to upload image to storage');
    }

    console.log('Image uploaded to storage:', uploadData.path);

    // Get public URL for the image
    const { data: urlData } = supabase.storage
      .from(bucketId)
      .getPublicUrl(filename);

    // Save record to database
    const { data: dbData, error: dbError } = await supabase
      .from('generated_images')
      .insert({
        user_id: user.id,
        prompt,
        image_url: urlData.publicUrl,
        file_path: filename,
        is_public: isPublic
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      throw new Error('Failed to save image record to database');
    }

    console.log('Image record saved to database:', dbData.id);

    return new Response(JSON.stringify({ 
      imageUrl: urlData.publicUrl,
      isPublic,
      prompt,
      id: dbData.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-image function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
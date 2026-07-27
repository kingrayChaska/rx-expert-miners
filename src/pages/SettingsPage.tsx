
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { sanitizeError } from '@/utils/errorHandler';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';

const SettingsPage = () => {
  const { t } = useLanguage();
  const [appName, setAppName] = useState('');
  const [appImageUrl, setAppImageUrl] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('app_settings').select('*').limit(1).single().then(({ data }) => {
      if (data) {
        setAppName(data.app_name || '');
        setAppImageUrl(data.app_image_url || null);
        setSettingsId(data.id);
      }
    });
  }, []);

  const handleSaveName = async () => {
    if (!settingsId) return;
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ app_name: appName })
      .eq('id', settingsId);
    setSaving(false);
    if (error) toast.error(sanitizeError(error));
    else toast.success(t('save'));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settingsId) return;

    // Validate file type — must match server-side allowed_mime_types on app-images bucket
    const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error('Only PNG, JPG, WEBP or GIF images are allowed');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `app-logo.${ext}`;

      // Upload to storage (upsert to replace existing)
      const { error: uploadError } = await supabase.storage
        .from('app-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('app-images')
        .getPublicUrl(filePath);

      // Add cache-busting param so the browser refreshes the image
      const urlWithCache = `${publicUrl}?t=${Date.now()}`;

      // Save URL to app_settings
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ app_image_url: urlWithCache })
        .eq('id', settingsId);

      if (updateError) throw updateError;

      setAppImageUrl(urlWithCache);
      toast.success('Image updated successfully');
    } catch (err: any) {
      toast.error(sanitizeError(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-xl font-bold text-foreground">{t('settings')}</h2>

      {/* App Name */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('appNameSetting')}</label>
          <Input
            value={appName}
            onChange={e => setAppName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
          />
        </div>
        <Button onClick={handleSaveName} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('save')}
        </Button>
      </div>

      {/* App Image */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <label className="text-sm font-medium">{t('appImage')}</label>

        {/* Preview */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {appImageUrl ? (
              <img
                src={appImageUrl}
                alt="App logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">PNG, JPG, WEBP · Max 5MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> {t('appImage')}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;





import { useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const playApprovalSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Silent fail if audio not supported
  }
};

/**
 * Global hook: listens for new approved devices and shows in-app toast to all users.
 * Also triggers the owner email notification edge function.
 */
export const useApprovalNotifications = () => {
  const { dir } = useLanguage();

  useEffect(() => {
    const channel = supabase
      .channel('approval_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'approved_devices' },
        async (payload) => {
          const record = payload.new as any;
          const serialNumber = record.serial_number || '';

          // Play alert sound
          playApprovalSound();

          // Show in-app toast to all users
          toast.success(
            dir === 'rtl'
              ? `✅ تمت الموافقة على جهاز: ${serialNumber}`
              : `✅ Device approved: ${serialNumber}`,
            { duration: 6000 }
          );

          // Trigger edge function to email owner
          try {
            await supabase.functions.invoke('notify-owner-approval', {
              body: {
                serial_number: serialNumber,
                model: record.model || null,
                approved_by: record.approved_by || null,
              },
            });
          } catch {
            // Silent fail — email is best-effort
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dir]);
};




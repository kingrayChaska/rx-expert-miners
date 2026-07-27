
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LanguageToggle = () => {
  const { lang, setLang } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className="gap-2"
    >
      <Globe className="h-4 w-4" />
      {lang === 'en' ? 'العربية' : 'English'}
    </Button>
  );
};

export default LanguageToggle;




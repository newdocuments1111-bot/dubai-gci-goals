import useEmblaCarousel from 'embla-carousel-react';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ListingGallery({ photos, title }: { photos: string[]; title: string }) {
  const [ref, api] = useEmblaCarousel({ loop: photos.length > 1 });
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!api) return;
    const selected = () => setIndex(api.selectedScrollSnap());
    api.on('select', selected); api.on('reInit', selected);
    return () => { api.off('select', selected); api.off('reInit', selected); };
  }, [api]);
  if (!photos.length) return <div className="grid aspect-[4/3] place-items-center bg-muted text-muted-foreground"><ImageIcon className="size-10" /></div>;
  return <section aria-label="Photo gallery" className="min-w-0">
    <div ref={ref} className="overflow-hidden rounded-lg"><div className="flex touch-pan-y">{photos.map((photo, i) => <div key={`${photo}-${i}`} className="min-w-0 flex-[0_0_100%]"><img src={photo} alt={`${title} — photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" /></div>)}</div></div>
    <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"><Button variant="outline" size="icon" title="Previous photo" aria-label="Previous photo" disabled={photos.length < 2} onClick={() => api?.scrollPrev()}><ChevronLeft className="size-4" /></Button><p aria-live="polite" className="text-center text-sm text-muted-foreground">Photo {index + 1} of {photos.length}</p><Button variant="outline" size="icon" title="Next photo" aria-label="Next photo" disabled={photos.length < 2} onClick={() => api?.scrollNext()}><ChevronRight className="size-4" /></Button></div>
  </section>;
}
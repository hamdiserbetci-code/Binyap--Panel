
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Firma, Proje } from '@/types';

interface ProjeSeciciProps {
  firmaId: string;
  onSelect: (projeId: string | null) => void;
}

export default function ProjeSecici({ firmaId, onSelect }: ProjeSeciciProps) {
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [seciliProje, setSeciliProje] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjeler() {
      const { data, error } = await supabase
        .from('projeler')
        .select('*')
        .eq('firma_id', firmaId);
      if (error) {
        console.error('Projeler yüklenirken hata:', error);
      } else {
        setProjeler(data);
      }
    }

    if (firmaId) {
      fetchProjeler();
    }
  }, [firmaId]);

  function handleProjeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const projeId = e.target.value || null;
    setSeciliProje(projeId);
    onSelect(projeId);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="proje-secici" className="text-sm font-medium text-slate-600">
        Proje:
      </label>
      <select
        id="proje-secici"
        className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all disabled:opacity-40"
        value={seciliProje ?? ''}
        onChange={handleProjeChange}
      >
        <option value="">Tüm Projeler</option>
        {projeler.map((proje) => (
          <option key={proje.id} value={proje.id}>
            {proje.ad}
          </option>
        ))}
      </select>
    </div>
  );
}

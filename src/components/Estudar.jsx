import { ListaMapas } from './Mapas.jsx';
import Leis from './Leis.jsx';
import Flashcards from './Flashcards.jsx';
import PdfInterativo from './PdfInterativo.jsx';
import LeituraVoz from './LeituraVoz.jsx';

// 📖 Estudar: PDF interativo, Leis, Flashcards, Mapas mentais e Leitura em voz alta
const ABAS = [
  ['pdf', '📘 PDF interativo'],
  ['leis', '⚖️ Leis'],
  ['flash', '🃏 Flashcards'],
  ['mapas', '🧠 Mapas mentais'],
  ['voz', '🎙️ Leitura em voz alta'],
];

export default function Estudar({ ctx }) {
  const aba = ctx.prefs.estudarAba || 'pdf';
  return (
    <div>
      <div className="abas" role="tablist" aria-label="Formas de estudar">
        {ABAS.map(([k, rot]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => ctx.setPrefs({ estudarAba: k })}>{rot}</button>
        ))}
      </div>
      {aba === 'pdf' && <PdfInterativo ctx={ctx} />}
      {aba === 'leis' && <Leis ctx={ctx} />}
      {aba === 'flash' && <Flashcards ctx={ctx} />}
      {aba === 'mapas' && <ListaMapas ctx={ctx} />}
      {aba === 'voz' && <LeituraVoz ctx={ctx} />}
    </div>
  );
}

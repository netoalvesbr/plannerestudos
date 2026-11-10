import { useEffect, useState } from 'react';

// Avisa quando o site foi atualizado e a página aberta ainda é a versão antiga
// (compara o arquivo principal desta página com o que o servidor entrega agora).
const atual = () => document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src') || '';

export default function NovaVersao() {
  const [nova, setNova] = useState(false);
  useEffect(() => {
    const meu = atual();
    if (!meu) return undefined;
    let ultimo = 0;
    const conferir = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimo < 60000) return;
      ultimo = Date.now();
      try {
        const html = await (await fetch('/?v=' + Date.now(), { cache: 'no-store' })).text();
        const doServidor = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1];
        if (doServidor && doServidor !== meu) setNova(true);
      } catch {
        // sem internet: tenta de novo depois
      }
    };
    conferir();
    const t = setInterval(conferir, 5 * 60000);
    document.addEventListener('visibilitychange', conferir);
    window.addEventListener('focus', conferir);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', conferir);
      window.removeEventListener('focus', conferir);
    };
  }, []);
  if (!nova) return null;
  return (
    <p className="aviso" role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'var(--pri-claro)', color: 'var(--txt)' }}>
      <span>🔄 <b>O EstudaAí foi atualizado.</b> Esta página ainda está na versão anterior; atualize para usar as novidades. Seus dados não são perdidos.</span>
      <button className="btn pri peq" onClick={() => window.location.reload()}>Atualizar agora</button>
    </p>
  );
}

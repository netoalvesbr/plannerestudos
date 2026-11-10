// Busca o texto de uma lei no site oficial (Planalto ou Senado) e devolve o HTML em UTF-8.
// Só aceita endereços desses sites oficiais. O resultado fica em cache por 1 dia na Vercel.
const PERMITIDOS = /^https:\/\/(www\.|www4\.)?planalto\.gov\.br\/ccivil_03\/|^https:\/\/(legis|www)\.senado\.leg\.br\//;

export default async function handler(req, res) {
  const url = String(req.query.url || '');
  if (!PERMITIDOS.test(url)) {
    res.status(400).json({ erro: 'Endereço não permitido. Só leis do Planalto ou do Senado.' });
    return;
  }
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'EstudaAi/1.0 (plataforma de estudos)' }, redirect: 'follow' });
    if (!r.ok) {
      res.status(502).json({ erro: `O site oficial respondeu com erro ${r.status}.` });
      return;
    }
    const bytes = new Uint8Array(await r.arrayBuffer());
    const cabecalho = (r.headers.get('content-type') || '').toLowerCase();
    const inicio = new TextDecoder('latin1').decode(bytes.slice(0, 2000)).toLowerCase();
    const utf8 = cabecalho.includes('utf-8') || /charset=["']?utf-8/.test(inicio);
    const html = new TextDecoder(utf8 ? 'utf-8' : 'windows-1252').decode(bytes);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(html);
  } catch (e) {
    res.status(502).json({ erro: 'Não foi possível acessar o site oficial agora: ' + e.message });
  }
}

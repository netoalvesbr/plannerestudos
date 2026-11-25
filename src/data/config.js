// Configurações gerais da plataforma.
// E-mails com papel de administrador (podem publicar conteúdo nas próximas versões).
export const ADMIN_EMAILS = ['alvesnetoac@gmail.com'];
export const NOME_PLATAFORMA = 'EstudaAí';

// Projeto Supabase (endereço e chave PÚBLICA – podem ficar no código; a proteção é feita pelas regras RLS do banco).
export const SUPABASE_URL = 'https://hhoemglewoefblywfefi.supabase.co';
export const SUPABASE_CHAVE_PUBLICA = 'sb_publishable_hekBSnW-hVAS9oOmQwhxww_UNVeHQ6X';

// Botões de login social exibidos na tela de entrada. Só inclua um provedor depois de ativá-lo no Supabase.
// Opções: 'google', 'azure' (Microsoft / Hotmail / Outlook), 'apple'.
export const PROVEDORES_LOGIN = ['google'];

// Canais de atendimento mostrados no rodapé e nas páginas de contato.
// ----- troque pelos seus dados antes de divulgar -----
export const CONTATO = {
  email: 'estudaai.suporte@gmail.com',
  whatsapp: '', // ex.: '5568999999999' (só números, com 55 na frente). Vazio = esconde o botão.
  prazoResposta: 'até 2 dias úteis',
  responsavel: 'Francisco Alves de Souza Neto',
  cidade: 'Rio Branco/AC',
};

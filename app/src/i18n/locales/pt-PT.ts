// Base language: português de Portugal. Every user-facing string lives here.
// Gender-neutral wording only: never assume "namorado/namorada".
const ptPT = {
  common: {
    appName: 'IceBreaker',
    next: 'Seguinte',
    start: 'Começar',
    genericError: 'Algo correu mal. Tenta outra vez.',
    save: 'Guardar',
    cancel: 'Cancelar',
    back: 'Voltar',
  },
  onboarding: {
    pages: [
      {
        title: 'Menos ecrã, mais vocês',
        body: 'Quando estão os dois em casa, cada um agarrado ao seu telemóvel, o IceBreaker manda-vos uma pequena missão a dois.',
      },
      {
        title: 'Cada um recebe metade',
        body: 'A missão chega numa notificação. Cada um sabe só uma parte: uma piada, um desafio, uma pergunta. O resto descobrem a falar.',
      },
      {
        title: 'Esta app quer ser pouco usada',
        body: 'Depois da missão, telemóveis em baixo. Não há pontos nem histórico, nada para ver aqui. Se quase não abrirem a app, está a funcionar.',
      },
    ],
  },
  signIn: {
    title: 'Entrar',
    body: 'Enviamos-te um código por email. Sem palavras-passe.',
    emailLabel: 'Email',
    sendCode: 'Enviar código',
    codeTitle: 'Código',
    codeBody: 'Escreve o código de 6 dígitos que enviámos para {{email}}.',
    codeLabel: 'Código de 6 dígitos',
    verify: 'Entrar',
    resend: 'Reenviar código',
    codeResent: 'Enviámos um código novo.',
    changeEmail: 'Usar outro email',
    invalidEmail: 'Esse email não parece válido.',
    sendFailed: 'Não foi possível enviar o código. Tenta outra vez daqui a pouco.',
    invalidCode: 'Código inválido ou expirado.',
  },
  profile: {
    title: 'Antes de começar',
    body: 'As missões usam estes nomes. Só tu os vês.',
    nameLabel: 'Como te chamas?',
    nicknameLabel: 'Como tratas a outra pessoa? (nome ou alcunha)',
    nicknameHint: 'Aparece nas tuas missões, por exemplo: "Conta uma piada a {{name}}".',
    nicknameExample: 'Kiko',
    invalid: 'Os nomes têm de ter entre 1 e 40 caracteres.',
  },
  pairing: {
    title: 'Emparelhar',
    body: 'Um de vocês gera um código e o outro escreve-o no seu telemóvel.',
    generate: 'Gerar código',
    codeTitle: 'O teu código',
    codeBody: 'Mostra este código à outra pessoa. Expira em {{time}}.',
    expired: 'O código expirou. Gera um novo.',
    share: 'Partilhar código',
    shareMessage: 'O meu código do IceBreaker é {{code}}',
    haveCode: 'Tenho um código',
    enterLabel: 'Código da outra pessoa',
    pair: 'Emparelhar',
    errors: {
      invalidCode: 'Código inválido ou expirado.',
      ownCode: 'Esse é o teu próprio código. Quem o tem de escrever é a outra pessoa.',
      alreadyPaired: 'Uma das contas já está emparelhada.',
      generic: 'Algo correu mal. Tenta outra vez.',
    },
  },
  home: {
    tagline: 'Esta app quer ser pouco usada.',
    settings: 'Definições',
  },
  settings: {
    title: 'Definições',
    unpair: 'Desemparelhar',
    unpairTitle: 'Desemparelhar?',
    unpairBody: 'Isto apaga o histórico do casal nos dois telemóveis. Não é possível desfazer.',
    signOut: 'Terminar sessão',
  },
};

export default ptPT;

export type Translations = typeof ptPT;

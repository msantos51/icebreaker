// Base language: português de Portugal. Every user-facing string lives here.
// Gender-neutral wording only: never assume "namorado/namorada".
const ptPT = {
  common: {
    appName: 'IceBreaker',
    next: 'Seguinte',
    start: 'Começar',
    genericError: 'Algo correu mal. Tenta outra vez.',
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
  home: {
    tagline: 'Esta app quer ser pouco usada.',
    signOut: 'Terminar sessão',
  },
};

export default ptPT;

export type Translations = typeof ptPT;

import { describe, expect, it } from 'vitest';

import { type Mission, validateCatalog, validateMission } from './missions.ts';

const valid: Mission = {
  id: 'co_test',
  type: 'coop',
  level: 1,
  tags: ['conversa'],
  message_a: 'Tens metade de uma pergunta para {parceiro}.',
  message_b: 'Tens a outra metade. Juntem as metades.',
  follow_up: 'Telemóveis em baixo.',
};

describe('validateMission', () => {
  it('accepts a valid mission', () => {
    expect(validateMission(valid)).toEqual([]);
  });

  it('rejects messages longer than 200 characters', () => {
    expect(validateMission({ ...valid, message_a: 'a'.repeat(201) })).toEqual([
      'message_a has 201 characters (max 200)',
    ]);
  });

  it('rejects empty messages', () => {
    expect(validateMission({ ...valid, follow_up: '  ' })).toEqual(['follow_up is empty']);
  });

  it('only allows the {parceiro} placeholder', () => {
    expect(validateMission({ ...valid, message_b: 'Olá {nome}.' })).toEqual([
      'message_b uses unknown placeholder {nome}',
    ]);
  });

  it('requires asymmetric messages', () => {
    expect(validateMission({ ...valid, message_b: valid.message_a })).toContain(
      'message_a and message_b must be different (missions are asymmetric)',
    );
  });

  it.each([
    ['Propõe três géneros e deixa-o eliminar um.', '-o'],
    ['Tenta convencê-la.', '-la'],
    ['Faz um elogio à tua namorada.', 'namorada'],
    ['Pergunta se ele quer chá.', 'ele'],
    ['Diz-lhe que a ideia dela é ótima.', 'dela'],
  ])('rejects gendered wording: %s', (message_a, match) => {
    expect(validateMission({ ...valid, message_a })).toEqual([
      `message_a assumes a gender: "${match}"`,
    ]);
  });

  it.each([
    'Pergunta-lhe o que recebeu.',
    'Olharem-se nos olhos.',
    'Elogia a {parceiro} a maneira de ser.',
    'Daqui a pouco vais receber um convite.',
  ])('accepts neutral wording: %s', (message_a) => {
    expect(validateMission({ ...valid, message_a })).toEqual([]);
  });

  it('rejects bad ids, levels and tags', () => {
    expect(
      validateMission({ ...valid, id: 'Bad Id', level: 4 as Mission['level'], tags: ['Nope'] }),
    ).toEqual([
      'id must be a lowercase slug',
      'level must be 1, 2 or 3',
      'tag "Nope" must be a lowercase slug',
    ]);
  });
});

describe('validateCatalog', () => {
  it('rejects duplicate ids', () => {
    expect(validateCatalog([valid, valid])).toEqual(['co_test: duplicate id']);
  });
});

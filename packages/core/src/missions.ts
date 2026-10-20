export const MISSION_TYPES = [
  'actor_audience',
  'secret_mission',
  'opposing',
  'coop',
  'kindness',
  'decision',
] as const;

export type MissionType = (typeof MISSION_TYPES)[number];

export type MissionLevel = 1 | 2 | 3;

export interface Mission {
  id: string;
  type: MissionType;
  level: MissionLevel;
  tags: string[];
  /** Message for the partner who gets role A. */
  message_a: string;
  /** Message for the partner who gets role B. */
  message_b: string;
  /** Sent to both shortly after the mission: always nudges the phones down. */
  follow_up: string;
}

/** Each message must fit entirely in a notification. */
export const MAX_MESSAGE_LENGTH = 200;

export const PARTNER_PLACEHOLDER = '{parceiro}';

const SLUG = /^[a-z0-9_]+$/;
const PLACEHOLDER = /\{[^}]*\}/g;

// Gendered words and clitic pronouns that would assume the partner's gender ("deixa-o",
// "convencê-la", "namorada", "ele"...). Missions must use {parceiro} or neutral phrasing instead.
const GENDERED = [
  /\b(namorad[oa]s?|marid[oa]s?|espos[oa]s?|mulher|homem)\b/i,
  /(^|[^\p{L}])(ele|ela|eles|elas|dele|dela|nele|nela)(?![\p{L}])/iu,
  /-(o|a|os|as|lo|la|los|las|no|na|nos|nas)(?![\p{L}])/iu,
];

/** Returns the list of problems with a mission; an empty list means it is valid. */
export function validateMission(mission: Mission): string[] {
  const problems: string[] = [];
  if (!SLUG.test(mission.id)) problems.push('id must be a lowercase slug');
  if (!MISSION_TYPES.includes(mission.type)) problems.push(`unknown type "${mission.type}"`);
  if (![1, 2, 3].includes(mission.level)) problems.push('level must be 1, 2 or 3');
  for (const tag of mission.tags) {
    if (!SLUG.test(tag)) problems.push(`tag "${tag}" must be a lowercase slug`);
  }

  const messages = {
    message_a: mission.message_a,
    message_b: mission.message_b,
    follow_up: mission.follow_up,
  };
  for (const [field, text] of Object.entries(messages)) {
    if (typeof text !== 'string' || text.trim() === '') {
      problems.push(`${field} is empty`);
      continue;
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      problems.push(`${field} has ${text.length} characters (max ${MAX_MESSAGE_LENGTH})`);
    }
    for (const placeholder of text.match(PLACEHOLDER) ?? []) {
      if (placeholder !== PARTNER_PLACEHOLDER) {
        problems.push(`${field} uses unknown placeholder ${placeholder}`);
      }
    }
    for (const pattern of GENDERED) {
      const match = text.match(pattern);
      if (match) problems.push(`${field} assumes a gender: "${match[0].trim()}"`);
    }
  }

  if (mission.message_a === mission.message_b) {
    problems.push('message_a and message_b must be different (missions are asymmetric)');
  }
  return problems;
}

/** Validates a whole catalogue, including id uniqueness. Returns problems prefixed by mission id. */
export function validateCatalog(missions: Mission[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const mission of missions) {
    if (seen.has(mission.id)) problems.push(`${mission.id}: duplicate id`);
    seen.add(mission.id);
    problems.push(...validateMission(mission).map((p) => `${mission.id}: ${p}`));
  }
  return problems;
}

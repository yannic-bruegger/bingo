export type WordList = {
  id: string;
  name: string;
  /** Label of the free centre cell on odd-sized cards. */
  freeLabel: string;
  /**
   * Each word carries its 1-based position as a number, shown on the card —
   * the way the original printed card labels its cells. The order of `words`
   * is then part of the data and must not change.
   */
  numbered?: boolean;
  words: string[];
};

/**
 * Lists that everybody in the app can pick. Custom lists live in the creator's
 * browser and are uploaded per round instead — see `src/lib/customLists.ts`.
 */
export const WORD_LISTS: WordList[] = [
  {
    id: 'winglbingo',
    name: 'Winglbingo',
    freeLabel: 'LÜGE',
    // Numbers as on the original card at mfbc.us/m/bcwgsjb (checked against it).
    numbered: true,
    words: [
      'schnauf / ßo',
      'Stärkelord / unbesiegt',
      'Fränkeln',
      'Verteidigung / Pazifismuslord',
      'die haider / mobbing',
      'der witz is / faggd ist / pointe is',
      'letztenendes / im endefeggd',
      'seit X Jahren / mei ganses Lebne',
      'Rainer und Zahlen',
      'Kinnergarten / sorry',
      'ich ich ich',
      'gefakedes lachen',
      'Welt verbesserungs lord',
      'Ankündigung',
      'mei zeuch machne / mei leben lebne',
      'verstellte Stimme / nachgeäffte Haiderstimme',
      'pfeiffen / singen',
      'uhrzeit / wetter / Datum',
      'benutzt Bonmots / Fachwort / Deutsch falsch',
      'Polizei',
      'die Nachbarn / mei Grundstügg / mei Auddo',
      'Arbeitslord / Ausrede',
      'haltlose denunziationen / diffamierung',
      'Privatsache',
      '1000x gsachd / Wiederhelungslord',
      'Schweizer Taschengumbel',
      'ihr wisst nichts / 2%',
      'ekelhafte sexuelle anspielung',
      'richtig schlechter Konter',
      'nennt Haidernamen / Beleidigung',
      'Warumääh / warum sollde ich?',
      'inderessand / Fokusbunggde',
      'ich raffs ned / hab ich vergessne',
      'Freindin',
      'hergehen / scheise baun',
      'Rage / Neidwut / Mana',
      'derjeniche / diejenichen',
      'muss grundles wiedersprechen / Besserwisserlord',
      'facepalm / slow clap',
      'Anglizismus den er nicht kann',
      'doppel / dreifach-räusperchen',
      'WAß? / Leselord / ding',
      'Rudi / Körperfunktien',
      'Belehrungslord',
      'sprich / wie gsachd',
      'Lets plays',
      'Brinzibiell / Im Brinzib',
      'nicht mal ansatzweise / bei weitem',
      'Techniklord',
      'Ja produkte / tetra pack',
      'spielzeug / Gadget / Bettellord',
      'banhammer / asozial',
      'BUMMSTI / Knarz',
      'Aggdsienen & Siduaddsienen',
      'schneiden / rendern / hochladne',
      'essen / trinken / rauchen',
      'musiklord (kein meddl)',
      'schlaganfall / verliert faden',
      'löcher im shirt / Verletzung',
      'Paranoia / alarmanlage',
    ],
  },
];

export function getList(id: string): WordList | undefined {
  return WORD_LISTS.find((l) => l.id === id);
}

export const DEFAULT_LIST_ID = WORD_LISTS[0].id;

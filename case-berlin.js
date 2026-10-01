// CASE: Berlin - "The Missing Master" (heist). Same data shape as case-thailand.js.
window.CASE_BERLIN = {
  id: 'berlin', country: 'Germany', city: 'Berlin', title: 'The Missing Master', streetName: 'Torstrasse',
  cover: 'be-archive.png', caseNo: 'Case file 03 / BER', tagline: 'A stolen master tape. Four suspects.',
  intro: "Halle Records keeps one reel it never lets out: the 1991 master of a techno record that built the label. At 02:41 the archive vault was opened with a valid keycard, the alarm quiet. By morning the reel in its box was blank tape. Four people had a way in.",
  howTo: "Walk each place, collect evidence, question people, then accuse. Wrong answers cost strikes.",
  suspects: [
    { id: 'katja', name: 'Katja Wendt', role: 'Label archivist', image: 'be-katja.png', bio: "Runs the archive and holds the vault card and alarm console." },
    { id: 'jonas', name: 'Jonas Reiter', role: 'Club doorman', image: 'be-jonas.png', bio: "Works the door at Club Null next to the label. Knows every face that walks past." },
    { id: 'lotte', name: 'Lotte Brandt', role: 'Record dealer', image: 'be-lotte.png', bio: "Runs a Sunday crate stall. Buys and sells rare pressings, asks few questions." },
    { id: 'anselm', name: 'Dr. Anselm Voigt', role: 'Collector', image: 'be-anselm.png', bio: "Has tried to buy the master for years and was refused every time." }
  ],
  locations: [
    { id: 'club', room: 'bar', name: 'Club Null', time: '02:10', image: 'be-club.png',
      blurb: 'The club next door to the label.', description: 'Bass through the walls, a queue on the pavement, a bouncer with a clipboard.', map: { x: 30, y: 40 },
      searches: [
        { id: 'clue-guestlist', x: 40, y: 60, title: 'The door list', text: 'The list shows the label staff leaving at 02:20 for a fire alarm test. The test was never scheduled.' },
        { id: 'clue-club-cctv', x: 75, y: 35, title: 'The street camera', text: 'The camera shows a woman in a black coat entering the label side door at 02:35 with a tote bag and leaving at 02:55.' }
      ],
      flavor: [ { id: 'fl-cl-strobe', x: 20, y: 30, title: 'Strobe', text: 'It flickers in time with the bass.' }, { id: 'fl-cl-stamp', x: 85, y: 70, title: 'Hand stamps', text: 'A black square. Smudged by morning.' } ],
      person: { suspectId: 'jonas', intro: 'Jonas does not look up from the clipboard. He keeps count out loud.', questions: [
        { q: 'Who did you see at the label door?', a: "'One person with a card. Black coat, tote. She said it was a test. I did not stop her. It was Katja, the archivist. She has a card, she has a reason.'", clueId: 'clue-jonas-testimony' },
        { q: 'Anyone else?', a: "'The collector, Voigt, asked me twice last week when the vault opens. I told him never.'" }
      ] } },
    { id: 'archive', room: 'studio', name: 'Halle Records Archive', time: '03:00', image: 'be-archive.png',
      blurb: 'The vault.', description: 'Steel shelves, grey boxes, one empty slot.', map: { x: 52, y: 28 },
      searches: [
        { id: 'clue-vault-log', x: 50, y: 55, title: 'The vault log', text: "The vault card 'KW' opened the door at 02:41. The alarm was set to maintenance mode from the archivist's own console at 02:38." },
        { id: 'clue-blank-reel', x: 25, y: 70, title: 'The blank reel', text: "The master's box holds a blank tape, relabelled in Katja Wendt's handwriting." },
        { id: 'clue-dust', x: 78, y: 45, title: 'The shelf dust', text: "Only one set of fingerprints crosses the dust on the shelf: small, gloved, repeated. The same hand has handled this reel every month." },
        { id: 'clue-royalty', x: 88, y: 76, title: 'The royalty letter', text: "A letter shows the label sold the master's rights last year without paying the original artists. Katja's name is on the file as the contact." }
      ],
      flavor: [ { id: 'fl-ar-box', x: 15, y: 30, title: 'Tape boxes', text: 'Hundreds of grey boxes, labelled in pencil.' }, { id: 'fl-ar-hum', x: 90, y: 15, title: 'The dehumidifier', text: 'It hums at a constant pitch.' } ] },
    { id: 'platform', room: 'tuktuk', name: 'U8 Platform, Heinrich-Heine-Straße', time: '04:20', image: 'be-platform.png',
      blurb: 'The first train out of the district.', description: 'Tiles, a flickering sign, an empty bench.', map: { x: 20, y: 66 },
      searches: [ { id: 'clue-ticket', x: 50, y: 55, title: 'The ticket', text: "A used single ticket stamped 04:12, found on the bench with a Mauerpark market flyer folded around it." } ],
      flavor: [ { id: 'fl-pl-sign', x: 22, y: 30, title: 'Departure sign', text: 'Next train in 4 minutes.' }, { id: 'fl-pl-map', x: 82, y: 16, title: 'The line map', text: 'U8: Wittenau to Hermannstraße.' } ] },
    { id: 'quay', room: 'pier', name: 'Oberbaum Quay', time: '05:10', image: 'be-quay.png',
      blurb: 'A quiet dock under the bridge.', description: 'River fog, a red-brick bridge, one parked van.', map: { x: 72, y: 54 },
      searches: [
        { id: 'clue-van', x: 60, y: 55, title: 'The van', text: "A rental van is parked here, hired in Lotte Brandt's name at 04:30. The cargo bay is empty, with a tape reel hub on the floor." },
        { id: 'clue-cash', x: 35, y: 70, title: 'The envelope', text: "A cash envelope with HVOIGT written on it, empty. A pawn stamp from a Kreuzberg dealer is on the back." }
      ],
      flavor: [ { id: 'fl-qu-bridge', x: 22, y: 40, title: 'The Oberbaum Bridge', text: 'Red brick, an old U-Bahn viaduct above the river.' }, { id: 'fl-qu-fog', x: 80, y: 14, title: 'River fog', text: 'It rolls off the Spree and swallows the lights.' } ],
      person: { suspectId: 'anselm', intro: 'Anselm stands under an umbrella that is far too large for the weather.', questions: [
        { q: 'Did you buy the master?', a: "'I made an offer to the label, which was refused. I buy things lawfully. I was here for the river, detective, as I am most mornings.'" },
        { q: 'Who sold it to you?', a: "'Nobody sold me anything. Ask the dealer who collects reels for a living.'" }
      ] } },
    { id: 'market', room: 'market', name: 'Mauerpark Flohmarkt', time: '09:00', image: 'be-market.png',
      blurb: 'The Sunday flea market.', description: 'Crates of vinyl, coffee, a busker on the hill.', map: { x: 44, y: 60 },
      searches: [
        { id: 'clue-crate', x: 50, y: 60, title: 'The crate', text: "A crate under Lotte's table holds a reel box with a Halle Records sticker half scraped off. The reel is not inside." },
        { id: 'clue-receipt-b', x: 78, y: 40, title: 'The stall receipt', text: "A receipt shows Lotte sold 'one tape reel, rare' at 08:15 for 4,000 euros in cash to 'A. V.'" }
      ],
      flavor: [ { id: 'fl-ma-busker', x: 20, y: 30, title: 'The busker', text: 'A guitar and a looped beat from a speaker.' }, { id: 'fl-ma-coffee', x: 85, y: 70, title: 'The coffee cart', text: 'Oat milk, apparently the only milk.' } ],
      person: { suspectId: 'lotte', intro: 'Lotte flips a record without looking at it. She has seen this question coming.', questions: [
        { q: 'Where did you get the reel?', a: "'A woman came to my stall at four in the morning with a tote and a box. Black coat. She wanted cash and she wanted a van booked. I did not ask her name.'", clueId: 'clue-lotte-testimony' },
        { q: 'Who did you sell to?', a: "'A collector. Dr. Voigt. He paid cash and carried it away himself. I take my cut and keep my head down.'" }
      ] } },
    { id: 'gallery', room: 'gallery', name: 'Galerie Wedding', time: '20:00', image: 'be-gallery.png',
      blurb: 'The night before: a listening party.', description: 'White walls, a sound installation, the label staff in conversation.', map: { x: 62, y: 20 },
      searches: [
        { id: 'clue-invite', x: 50, y: 40, title: 'The invitation', text: "The listening party was in honour of the 1991 master. Katja was the only archivist invited to the stage and she left before the end." },
        { id: 'clue-argument', x: 22, y: 70, title: 'The overheard argument', text: "Two guests overheard Katja arguing with the label boss: 'You sold their record and never paid them. I won't be the one who keeps the lie.'" }
      ],
      flavor: [ { id: 'fl-ga-speaker', x: 15, y: 40, title: 'The speaker array', text: 'Twelve speakers in a ring, playing the track at low volume.' }, { id: 'fl-ga-wine', x: 86, y: 20, title: 'Wine glasses', text: 'Half-finished, lipstick on the rim.' } ] }
  ],
  links: [['clue-vault-log', 'clue-blank-reel'], ['clue-vault-log', 'clue-club-cctv'], ['clue-jonas-testimony', 'clue-guestlist'], ['clue-royalty', 'clue-argument'], ['clue-lotte-testimony', 'clue-receipt-b'], ['clue-van', 'clue-lotte-testimony'], ['clue-cash', 'clue-receipt-b'], ['clue-ticket', 'clue-crate']],
  culprit: 'katja',
  evidenceAnswer: ['clue-vault-log', 'clue-blank-reel'],
  evidenceHint: 'The log shows the way in. The reel shows whose hand did it.',
  deduction: [
    { question: 'How was the vault opened without tripping the alarm?', options: ["The archivist's own card and her alarm console on maintenance mode", 'The lock was forced from the loading dock', 'The doorman let a stranger in'], correct: 0, explain: "KW's card opened the door three minutes after her console switched the alarm to maintenance." },
    { question: 'Where did the master go after the vault?', options: ['Sold to a collector through the Mauerpark dealer', 'Hidden inside the label office', 'Dropped in the Spree'], correct: 0, explain: 'The van, the cash envelope and the stall receipt carry it from the quay to Dr. Voigt.' }
  ],
  winText: "Katja Wendt is waiting at the U8 platform with her bag packed. She says she did it for the artists the label never paid. The master is recovered from Voigt's flat that afternoon, and the label starts writing cheques.",
  loseText: 'The accusation falls apart. The tape is still gone. Go back through the evidence and try again.'
};

// CASE: Hong Kong - "The Last Ferry" (murder). Same data shape as case-thailand.js.
window.CASE_HONGKONG = {
  id: 'hongkong', country: 'Hong Kong', city: 'Hong Kong', title: 'The Last Ferry', streetName: 'Des Voeux Road',
  cover: 'hk-ferry.png', caseNo: 'Case file 02 / HKG', tagline: 'A dead broker. Four suspects.',
  intro: "Walter Lam, a shipping broker, was found slumped at the rail of the 23:15 Star Ferry, a cup still in his hand. The police call it a fall. His daughter does not. Four people had a reason, and you have until the ferry runs again at dawn.",
  howTo: "Walk each place, collect evidence, question people. Wrong accusations cost strikes.",
  suspects: [
    { id: 'raymond', name: 'Raymond Chow', role: 'Business partner', image: 'hk-raymond.png', bio: "Walter's partner for twenty years. Keeps the books at Lam & Chow Shipping." },
    { id: 'mei', name: 'Mei Lam', role: "Walter's daughter", image: 'hk-mei.png', bio: "Argued with her father last week about the firm. Inherits his share." },
    { id: 'daisy', name: 'Daisy Ng', role: 'Mahjong parlour owner', image: 'hk-daisy.png', bio: "Walter played at her tables every Thursday. Gossip says he owed the house." },
    { id: 'fai', name: 'Ah Fai', role: 'Ferry deckhand', image: 'hk-fai.png', bio: "Found the body. Has worked the harbour boats for thirty years and sees everything." }
  ],
  locations: [
    { id: 'mahjong', room: 'bar', name: 'Fortune Mahjong Parlour', time: '22:00', image: 'hk-mahjong.png',
      blurb: 'Where Walter spent his last evening.', description: 'Tiles clack under green lamps. Walter left his seat at 22:40 and never came back.', map: { x: 38, y: 58 },
      searches: [
        { id: 'clue-score', x: 40, y: 60, title: 'The score sheet', text: "Walter was up HK$3,000 when he left at 22:40. He owed the house nothing." },
        { id: 'clue-call', x: 70, y: 40, title: 'The phone on the table', text: "Walter took a call at 22:35, said 'Fine. Bring it to the ferry,' paid his tab and left in a hurry. The caller was on his desk-phone line, not a mobile." }
      ],
      flavor: [
        { id: 'fl-mj-tiles', x: 20, y: 50, title: 'The last hand', text: 'His tiles are still face-down at his seat. Nobody dares move them.' },
        { id: 'fl-mj-fan', x: 85, y: 20, title: 'Ceiling fan', text: 'It wobbles on every turn. Nobody has fixed it since the nineties.' }
      ],
      person: { suspectId: 'daisy', intro: 'Daisy shuffles tiles without looking at them. She watches you the whole time.', questions: [
        { q: 'Did Walter owe you money?', a: "'Walter? Never. He lost small and won small, and he paid in cash before he stood up. If someone told you otherwise, they wanted you looking at me.'", clueId: 'clue-daisy-testimony' },
        { q: 'Who called him?', a: "'The parlour phone rang for him at 22:35. A man, polite. Walter said it was business and he was angry, not scared.'" }
      ] } },
    { id: 'stall', room: 'market', name: 'Dai Pai Dong, Sheung Wan', time: '22:30', image: 'hk-stall.png',
      blurb: 'An open-air food stall where Mei waited out the night.', description: 'Steam, neon, plastic stools. Mei has a bowl of noodles she has not touched.', map: { x: 24, y: 40 },
      searches: [
        { id: 'clue-mei-receipt', x: 30, y: 60, title: 'The receipt', text: "Mei's noodle receipt is stamped 22:20 for the order and 23:41 for the second tea. She never left her stool while her father died." },
        { id: 'clue-hawker', x: 70, y: 55, title: "The hawker's memory", text: "The stall owner remembers a grey-coated man hurrying toward Central Pier at about 23:00, carrying a metal flask, tucked under his arm." }
      ],
      flavor: [
        { id: 'fl-st-wok', x: 50, y: 70, title: 'The wok', text: 'The flame roars blue. The cook yells orders in three dialects.' },
        { id: 'fl-st-bulbs', x: 80, y: 15, title: 'Hanging bulbs', text: 'Orange bulbs sway on a cable over the stools.' }
      ],
      person: { suspectId: 'mei', intro: 'Mei grips a paper cup. Her eyes are red but her voice is steady.', questions: [
        { q: 'Why did you fight with your father?', a: "'He wanted to sell the firm. I thought he was being pushed. Then last Monday he told me Raymond had been hiding money for years and he finally had proof. He was going to the auditors on Friday.'", clueId: 'clue-mei-testimony' },
        { q: 'Do you inherit?', a: "'His share, yes. I would burn it to have him back. Ask the ferry crew who was on that deck, not who gets the money.'" }
      ] } },
    { id: 'office', room: 'studio', name: 'Lam & Chow Shipping', time: '23:55', image: 'hk-office.png',
      blurb: "Walter's office, sealed by the police.", description: 'Ledgers, a shredder, and a window onto the harbour. The desk lamp is still on.', map: { x: 56, y: 28 },
      searches: [
        { id: 'clue-ledger-copy', x: 46, y: 56, title: 'The photocopied ledger', text: "Walter photocopied the books. Dozens of payments to 'RC Holdings', all signed off in Raymond Chow's handwriting. The original ledger is gone from the safe." },
        { id: 'clue-audit', x: 78, y: 40, title: "The auditor's email", text: "A printed email: Walter confirmed a meeting with the auditors for Friday at 09:00. Raymond is copied on the reply." },
        { id: 'clue-note', x: 30, y: 70, title: 'The desk note', text: "In Walter's hand: 'Ferry 23:15 - bring the real ledger. R.' Underlined twice." },
        { id: 'clue-shredder', x: 88, y: 76, title: 'The shredder bin', text: "Strips of a cheque, reassembled: payee 'RC Holdings', signed 'R. Chow'. Shredded today." }
      ],
      flavor: [
        { id: 'fl-of-window', x: 15, y: 30, title: 'The harbour window', text: 'The Star Ferry crosses in the dark below. From here you can see the pier.' },
        { id: 'fl-of-plant', x: 90, y: 20, title: 'Dying orchid', text: 'It needs water. Walter forgot it this week.' }
      ] },
    { id: 'ferry', room: 'pier', name: 'Star Ferry, Upper Deck', time: '23:15', image: 'hk-ferry.png',
      blurb: 'Where Walter was found.', description: 'Wet benches, a cold rail, the skyline sliding past. A taped outline on the bench.', map: { x: 70, y: 52 },
      searches: [
        { id: 'clue-octopus', x: 60, y: 55, title: 'The fare gate log', text: "The gate log shows an Octopus card tapped at 23:12 for the 23:15 crossing. The card is registered to Raymond Chow." },
        { id: 'clue-cup', x: 40, y: 70, title: 'The metal cup', text: "Walter's cup holds a sedative residue. Someone brought him a drink in a flask and he drank it on deck." }
      ],
      flavor: [
        { id: 'fl-fe-lifebelt', x: 22, y: 40, title: 'Life belt', text: 'Untouched. No one tried to save him.' },
        { id: 'fl-fe-skyline', x: 80, y: 14, title: 'The skyline', text: 'Lit towers, a wet rail, and a very quiet deck.' }
      ],
      person: { suspectId: 'fai', intro: 'Fai coils a rope by habit, then stops and looks at you.', questions: [
        { q: 'Who did you see?', a: "'A man in a grey coat got off on the Tsim Sha Tsui side before the boat docked. He had a flask. I thought nothing of it until I found the old man.'", clueId: 'clue-fai-testimony' },
        { q: 'Was there a fight?', a: "'No. He was already slumped when I came by. No shouting. No struggle.'" }
      ] } },
    { id: 'hotel', room: 'gallery', name: 'Harbour Grand Hotel Lobby', time: '22:30', image: 'hk-hotel.png',
      blurb: "Raymond's alibi.", description: 'Marble, brass, a quiet pianist. Raymond sits at the lobby bar like a man waiting for a table.', map: { x: 44, y: 20 },
      searches: [
        { id: 'clue-hotel-cctv', x: 50, y: 40, title: 'The lobby camera', text: "The lobby camera shows Raymond at the bar until 22:58, then he leaves by the side door toward the pier. He was back at 00:20." },
        { id: 'clue-thermos-order', x: 20, y: 70, title: 'The bar tab', text: "Raymond ordered a double whisky and a metal flask 'to go' at 22:50, paid in cash. The barman remembers it because he never takes anything out." },
        { id: 'clue-coat-tag', x: 78, y: 62, title: 'The cloakroom tag', text: "The cloakroom has no grey coat on Raymond's ticket. He collected nothing when he left." }
      ],
      flavor: [
        { id: 'fl-ho-piano', x: 18, y: 40, title: 'The pianist', text: 'He plays Cantopop standards. The room barely listens.' },
        { id: 'fl-ho-clock', x: 86, y: 20, title: 'The lobby clock', text: 'It runs two minutes fast. Staff keep it that way on purpose.' }
      ],
      person: { suspectId: 'raymond', intro: 'Raymond straightens his cuffs. He has the face of a man who rehearsed this.', questions: [
        { q: 'Where were you at 23:15?', a: "'Here. All night. Ask anyone. Walter and I were partners. I am grieving, detective, not hiding.'" },
        { q: 'What is RC Holdings?', a: "'A holding vehicle. Everything is in order. Walter was tired and confused, he had been drinking.'" }
      ] } },
    { id: 'tram', room: 'tuktuk', name: 'Des Voeux Road Tram Stop', time: '23:05', image: 'hk-tram.png',
      blurb: 'The last tram stop before the pier.', description: 'A double-decker tram clanks in. A conductor holds up a lost coat.', map: { x: 18, y: 66 },
      searches: [
        { id: 'clue-coat', x: 55, y: 55, title: 'The lost grey coat', text: "The conductor handed in a grey coat left on the 23:20 tram toward Central. The lining is monogrammed 'RC'. A metal flask cap is in the pocket." }
      ],
      flavor: [
        { id: 'fl-tr-bell', x: 20, y: 30, title: 'The tram bell', text: 'Clangs twice every stop. Nobody hears it anymore.' },
        { id: 'fl-tr-sign', x: 82, y: 15, title: 'The route sign', text: 'West to Kennedy Town, east to Shau Kei Wan.' }
      ] }
  ],
  links: [['clue-octopus', 'clue-hotel-cctv'], ['clue-thermos-order', 'clue-cup'], ['clue-ledger-copy', 'clue-audit'], ['clue-audit', 'clue-note'], ['clue-coat', 'clue-fai-testimony'], ['clue-coat', 'clue-coat-tag'], ['clue-mei-receipt', 'clue-mei-testimony'], ['clue-score', 'clue-daisy-testimony'], ['clue-shredder', 'clue-ledger-copy'], ['clue-hawker', 'clue-coat']],
  culprit: 'raymond',
  evidenceAnswer: ['clue-octopus', 'clue-ledger-copy'],
  evidenceHint: 'One piece puts him on the boat. One gives him a reason.',
  deduction: [
    { question: 'Why was Walter killed?', options: ['He was about to expose a fraud before the auditors', 'He owed money at the mahjong parlour', 'A fight over his inheritance'], correct: 0, explain: 'The ledger copy and the auditor email show a Friday meeting that would have ended the firm.' },
    { question: 'How was Walter lured and killed?', options: ['Sedated with a drink from a flask on the 23:15 ferry', 'Pushed from the rail in a fight', 'Poisoned at the mahjong table'], correct: 0, explain: 'The flask, the sedative in his cup and the Octopus tap put Raymond on that deck.' }
  ],
  winText: 'Raymond Chow is stopped at the pier gate with a one-way ticket to Macau. The original ledger is in his briefcase. The Star Ferry runs again at dawn. Walter Lam does not, but his daughter finally sleeps.',
  loseText: 'The accusation fails. The ferry leaves without a verdict. Go back through the evidence and try again.'
};

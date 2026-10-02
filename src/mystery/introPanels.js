// introPanels.js
// Story text for the Level 1 picture story. Edit the words here, not in code.
// art picks the built in drawing: bureau, village, night, door, hall.
// image is optional. Drop a file in public/assets/intro/ and it replaces the drawing.
// If the file is missing the built in drawing is used instead.

export const INTRO_PANELS = [
  {
    art: 'bureau',
    image: './assets/intro/panel1.png',
    label: 'The Bureau',
    text:
      'The Interstellar Bureau keeps the peace across a thousand worlds.\n' +
      'You are one of its agents.\n' +
      'Haru was your partner for twenty years.',
  },
  {
    art: 'village',
    image: './assets/intro/panel2.png',
    label: 'The Retirement',
    text:
      'Then Haru retired.\n' +
      'He chose Earth, a quiet village in Japan, and lived there as a human.\n' +
      'He said it was the only place that ever felt like home.',
  },
  {
    art: 'night',
    image: './assets/intro/panel3.png',
    label: 'The Message',
    text:
      'Months passed.\n' +
      'Tonight a message reached Bureau headquarters.\n' +
      'Haru is dead. He was found in his own house, at dusk.',
  },
  {
    art: 'door',
    image: './assets/intro/panel4.png',
    label: 'The Case',
    text:
      'No witnesses. No suspects.\n' +
      'The local police were told to touch nothing.\n' +
      'The case is yours.',
  },
  {
    art: 'hall',
    image: './assets/intro/panel5.png',
    label: 'The House',
    text:
      'Search the house. Read what he left behind.\n' +
      'Nothing here is there by accident.',
    note: 'W A S D move · Mouse look · Shift faster · Q scanner · E examine',
  },
];


// All text on the site lives here. Edit freely; no layout code needed.
//
// The page is a boosted ensemble: the name at the top is the prediction,
// and scrolling breaks it into the trees that add up to it, in order.
// Each tree has nodes; each node has a one-line `summary` (its leaf), and
// can also take `meta`, `details` bullets, and a `link` ({ label, href }). Wrap text in *asterisks* to italicize it.

export const SITE = {
  name: 'Alan Dong',
  role: 'MLE Intern at Netramind Innovations',
  subtitle: 'AI/ML for Bio',
  contact: [
    { label: 'awdong@andrew.cmu.edu', href: 'mailto:awdong@andrew.cmu.edu' },
    { label: 'linkedin.com/in/alan-w-dong', href: 'https://www.linkedin.com/in/alan-w-dong' },
    { label: 'github.com/wenkwonk', href: 'https://github.com/wenkwonk' },
  ],
  // The closing "prediction" at the bottom of the page.
  next: "I work where code meets biology, because I want what I build to do some good. Next up: industry, and maybe a PhD.",
};

export const TREES = [
  // Each node has a `split` (the condition on its branch) and a `value`
  // (its leaf value). `path` is the index of the node this person is routed
  // to, which is what the tree adds to the prediction. The six path values
  // add up to 1.00.
  {
    id: 'education',
    title: 'Education',
    note: 'the base learner',
    path: 2,
    nodes: [
      { split: 'age < 12', value: 0.08, title: 'Growing up', summary: "Coding since I was a kid. My dad's a programmer, so it was always around." },
      { split: 'age < 18', value: 0.14, title: 'High school', summary: 'Fell in love with biology.' },
      { split: 'age ≥ 18', value: 0.30, title: 'Carnegie Mellon', summary: 'Came for bio, rediscovered code. Now I study statistics and machine learning, with a CS minor.' },
    ],
  },

  {
    id: 'skills',
    title: 'Skills',
    path: 0,
    nodes: [
      { split: 'task = model', value: 0.12, title: 'Machine learning', summary: 'PyTorch, XGBoost, and the rest of the Python toolkit.' },
      { split: 'task = vision', value: 0.09, title: 'Images', summary: 'OpenCV, mostly pointed at microscopes and eye scans.' },
      { split: 'task = genomes', value: 0.07, title: 'Biology', summary: 'Genome tools like breseq and BLAST.' },
      { split: 'task = talk', value: 0.03, title: 'Languages', summary: 'English, Mandarin, and Cantonese.' },
    ],
  },

  {
    id: 'projects',
    title: 'Projects',
    path: 0,
    nodes: [
      { split: 'data scarce?', value: 0.18, title: 'Generative Omics', summary: 'Making realistic fake microscopy images, and testing whether they help train real models.' },
      { split: 'time-lapse?', value: 0.11, title: 'Bacteria Bouncer', summary: "Watches bacteria grow over time and ignores the junk that doesn't move." },
      { split: 'game on?', value: 0.06, title: 'MiniMotorwayer', summary: 'A bot that plays a game just by looking at the screen.' },
    ],
  },

  {
    id: 'experience',
    title: 'Experience',
    path: 0,
    nodes: [
      { split: 'sample = retina', value: 0.22, title: 'Netramind', summary: 'Using eye scans to predict how well people can see.' },
      { split: 'sample = bacteria', value: 0.17, title: 'Bridges Lab', summary: 'Teaching models to tell how bacteria react to antibiotics, just from how they look.' },
    ],
  },

  {
    id: 'leadership',
    title: 'Leadership & awards',
    path: 0,
    nodes: [
      {
        split: 'event = hackathon', value: 0.10, title: 'TartanHacks',
        summary: 'Won our track with a whole game that fits in 15KB.',
        link: { label: 'Play it', href: 'https://wenkwonk.github.io/echo_public_test/' },
      },
      { split: 'event = club', value: 0.08, title: 'Hong Kong Student Association', summary: 'President.' },
    ],
  },

  {
    id: 'hobbies',
    title: 'Hobbies',
    note: 'fit to the residual',
    path: 0,
    nodes: [
      { split: 'where = court', value: 0.08, title: 'Basketball', summary: 'Playing it.' },
      { split: 'where = couch', value: 0.05, title: 'NBA & NFL', summary: 'Watching them.' },
      { split: 'where = desk', value: 0.02, title: 'Video games', summary: 'Now and then.' },
    ],
  },
];

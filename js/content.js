// All text on the site lives here. Edit freely; no layout code needed.
//
// The page is a boosted ensemble: the name at the top is the prediction,
// and scrolling breaks it into the trees that add up to it, in order.
// Each tree has nodes; each node has a one-line `summary` (its leaf), and
// can also take `meta` and `details` bullets if you ever want more. Wrap text in *asterisks* to italicize it.

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
  {
    id: 'education',
    title: 'Education',
    note: 'the base learner',
    nodes: [
      { title: 'Growing up', summary: "Coding since I was a kid. My dad's a programmer, so it was always around." },
      { title: 'High school', summary: 'Fell in love with biology.' },
      { title: 'Carnegie Mellon', summary: 'Came for bio, rediscovered code. Now I study statistics and machine learning, with a CS minor.' },
    ],
  },

  {
    id: 'skills',
    title: 'Skills',
    nodes: [
      { title: 'Machine learning', summary: 'PyTorch, XGBoost, and the rest of the Python toolkit.' },
      { title: 'Images', summary: 'OpenCV, mostly pointed at microscopes and eye scans.' },
      { title: 'Biology', summary: 'Genome tools like breseq and BLAST.' },
      { title: 'Languages', summary: 'English, Mandarin, and Cantonese.' },
    ],
  },

  {
    id: 'projects',
    title: 'Projects',
    nodes: [
      { title: 'Generative Omics', summary: 'Making realistic fake microscopy images, and testing whether they help train real models.' },
      { title: 'Bacteria Bouncer', summary: "Watches bacteria grow over time and ignores the junk that doesn't move." },
      { title: 'MiniMotorwayer', summary: 'A bot that plays a game just by looking at the screen.' },
    ],
  },

  {
    id: 'experience',
    title: 'Experience',
    nodes: [
      { title: 'Netramind', summary: 'Using eye scans to predict how well people can see.' },
      { title: 'Bridges Lab', summary: 'Teaching models to tell how bacteria react to antibiotics, just from how they look.' },
    ],
  },

  {
    id: 'leadership',
    title: 'Leadership & awards',
    nodes: [
      { title: 'TartanHacks', summary: 'Won our track with a whole game that fits in 15KB.' },
      { title: 'Hong Kong Student Association', summary: 'I lead it at CMU.' },
    ],
  },

  {
    id: 'hobbies',
    title: 'Hobbies',
    note: 'fit to the residual',
    nodes: [
      { title: 'Basketball', summary: 'Playing it.' },
      { title: 'NBA & NFL', summary: 'Watching them.' },
      { title: 'Video games', summary: 'Now and then.' },
    ],
  },
];

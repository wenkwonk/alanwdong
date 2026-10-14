// All text on the site lives here. Edit freely; no layout code needed.
//
// The page is a boosted ensemble: the name at the top is the prediction,
// and scrolling breaks it into the trees that add up to it, in order.
// Each tree has nodes; each node has a one-line `summary` (its leaf), and
// can also take `more` (bullets shown when the visitor clicks for more),
// and a `link` ({ label, href }). Wrap text in *asterisks* to italicize it.

export const SITE = {
  name: 'Alan Dong',
  role: 'MLE Intern at Netramind Innovations',
  subtitle: 'AI/ML for Bio',
  contact: [
    { label: 'awdong@andrew.cmu.edu', href: 'mailto:awdong@andrew.cmu.edu' },
    { label: 'linkedin.com/in/alan-w-dong', href: 'https://www.linkedin.com/in/alan-w-dong' },
    { label: 'github.com/wenkwonk', href: 'https://github.com/wenkwonk' },
  ],
  // "Who's visiting?" choices. Each tree's `routes` says which node each
  // kind of visitor is sent to; with no choice, a tree uses its `path`.
  visitors: ['recruiter', 'researcher', 'friend'],
  // The closing "prediction" at the bottom of the page.
  next: "I work where code meets biology, because I want what I build to do some good. Next up: industry, and maybe a PhD.",
};

export const TREES = [
  // Each node has a `split` (the condition on its branch) and a `value`
  // (its leaf value). `path` is the index of the node I'm routed to (the six
  // path values add up to 1.00); `routes` does the same per visitor.
  {
    id: 'education',
    title: 'Education',
    note: 'the base learner',
    path: 2,
    routes: { recruiter: 2, researcher: 1, friend: 0 },
    nodes: [
      { split: 'age < 12', value: 0.08, title: 'Growing up', summary: "Coding since I was a kid. My dad's a programmer, so it was always around." },
      { split: 'age < 18', value: 0.14, title: 'High school', summary: 'Fell in love with biology.' },
      {
        split: 'age ≥ 18', value: 0.30, title: 'Carnegie Mellon',
        summary: 'Came for bio, rediscovered code. Now I study statistics and machine learning, with a CS minor.',
        more: [
          'B.S. Statistics & Machine Learning, Minor in Computer Science',
          'Coursework: Functional Programming (SML), Data Structures & Algorithms (C), Discrete Math & Proofs, Linear Algebra, Probability Theory, Statistics & Data Science (R)',
        ],
      },
    ],
  },

  {
    id: 'skills',
    title: 'Skills',
    path: 0,
    routes: { recruiter: 0, researcher: 2, friend: 3 },
    nodes: [
      {
        split: 'task = model', value: 0.12, title: 'Machine learning',
        summary: 'PyTorch, XGBoost, and the rest of the Python toolkit.',
        more: ['Python (PyTorch, OpenCV, NumPy, Pandas, Matplotlib, Scikit-Learn), R, SQL, HuggingFace, XGBoost'],
      },
      { split: 'task = vision', value: 0.09, title: 'Images', summary: 'OpenCV, mostly pointed at microscopes and eye scans.' },
      {
        split: 'task = genomes', value: 0.07, title: 'Biology',
        summary: 'Genome tools like breseq and BLAST.',
        more: ['Biopython, breseq, BLAST, whole-genome sequencing, label-free imaging'],
      },
      { split: 'task = talk', value: 0.03, title: 'Languages', summary: 'English, Mandarin, and Cantonese.' },
    ],
  },

  {
    id: 'projects',
    title: 'Projects',
    path: 0,
    routes: { recruiter: 0, researcher: 1, friend: 2 },
    nodes: [
      {
        split: 'data scarce?', value: 0.18, title: 'Generative Omics',
        summary: 'Making realistic fake microscopy images, and testing whether they help train real models.',
        more: [
          'Built a pipeline quantifying biological parameters from seed micrograph data to drive GenAI-generated imagery, with full measured/cited/default provenance and validation against real-world data',
          'Designed an LLM research API client (Anthropic SDK, 40+ mocked tests) with hard staging invariants blocking unreviewed findings',
          'Currently benchmarking synthetic data utility via segmentation model training against real-data baselines',
        ],
      },
      {
        split: 'time-lapse?', value: 0.11, title: 'Bacteria Bouncer',
        summary: "Watches bacteria grow over time and ignores the junk that doesn't move.",
        more: [
          'Quantifies bacterial biomass over time from 16-bit brightfield microscopy, correcting stage drift from image metadata',
          'Temporal artifact rejection that decays first-frame debris masks unless sustained by neighboring detections',
          'Parallel per-well analysis with a cancellable process pool and a desktop GUI',
        ],
      },
      {
        split: 'game on?', value: 0.06, title: 'MiniMotorwayer',
        summary: 'A bot that plays a game just by looking at the screen.',
        more: [
          'CV pipeline turning screen captures into a structured game-state model via contour analysis and color classification',
          'Modular dynamic A* pathfinding to automate solutions',
        ],
      },
    ],
  },

  {
    id: 'experience',
    title: 'Experience',
    path: 0,
    routes: { recruiter: 0, researcher: 1, friend: 0 },
    nodes: [
      {
        split: 'sample = retina', value: 0.22, title: 'Netramind',
        summary: 'Using eye scans to predict how well people can see.',
        more: [
          'Machine Learning Engineer Intern, Jun 2026 – present',
          'XGBoost model predicting per-stimulus microperimetry sensitivity from retinal OCT features (17,026 stimuli, 112 patients), cutting pooled MAE 13% (3.45 → 3.01 dB) under patient-grouped 10-fold CV',
          'PyTorch/OpenCV registration pipeline aligning microperimetry and OCT scans (feature matching, RANSAC affine, thin-plate-spline warping), registering 18,907 points',
          'Replaced a SIFT baseline with ALIKED + LightGlue, raising mean RANSAC inliers ~8.1× (78 → 632)',
        ],
      },
      {
        split: 'sample = bacteria', value: 0.17, title: 'Bridges Lab',
        summary: 'Teaching models to tell how bacteria react to antibiotics, just from how they look.',
        more: [
          'Undergraduate Research Assistant at CMU, Jan 2026 – present',
          'Deep learning and XGBoost classifiers on 300+ GB of label-free brightfield imaging to identify antibiotic response mechanisms in *S. pneumoniae*',
          'breseq scripts aligning whole-genome sequencing reads from 6 evolved *V. cholerae* lineages, identifying 243 mutations from adaptive laboratory evolution',
          'Matplotlib pipeline turning raw CSVs into publication-ready plots',
        ],
      },
    ],
  },

  {
    id: 'leadership',
    title: 'Leadership & awards',
    path: 0,
    routes: { recruiter: 0, researcher: 0, friend: 1 },
    nodes: [
      {
        split: 'event = hackathon', value: 0.10, title: 'TartanHacks',
        summary: 'Won our track with a whole game that fits in 15KB.',
        more: ['1st Place, Axon/AppLovin Track, Feb 2026: 1,050+ competitors; top project for memory efficiency, a fully functional HTML/JS game under a strict 15KB limit'],
        link: { label: 'Play it', href: 'https://wenkwonk.github.io/echo_public_test/' },
      },
      {
        split: 'event = club', value: 0.08, title: 'Hong Kong Student Association',
        summary: 'President.',
        more: ['Lead 273 members and a $6,000+ annual budget'],
      },
    ],
  },

  {
    id: 'hobbies',
    title: 'Hobbies',
    note: 'fit to the residual',
    path: 0,
    routes: { recruiter: 0, researcher: 2, friend: 1 },
    nodes: [
      { split: 'where = court', value: 0.08, title: 'Basketball', summary: 'Playing it.' },
      { split: 'where = couch', value: 0.05, title: 'NBA & NFL', summary: 'Watching them.' },
      { split: 'where = desk', value: 0.02, title: 'Video games', summary: 'Now and then.' },
    ],
  },
];

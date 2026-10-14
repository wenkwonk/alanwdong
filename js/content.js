// All text on the site lives here. Edit freely; no layout code needed.
//
// The page is a boosted ensemble: the name at the top is the prediction,
// and scrolling breaks it into the trees that add up to it, in order.
// Each tree has nodes; each node can have a short `summary` and `details`
// bullets (its leaves). Wrap text in *asterisks* to italicize it.

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
  next: "Now I work where code and biology meet, because I want what I build to do some good. Next: taking these skills into real-world work through industry, and maybe a PhD after that.",
};

export const TREES = [
  {
    id: 'education',
    title: 'Education',
    note: 'the base learner',
    nodes: [
      {
        title: 'Growing up',
        summary: "I've been coding for as long as I can remember. My dad is a lifelong programmer, so it was always around.",
      },
      {
        title: 'High school',
        summary: 'Fell in love with biology.',
      },
      {
        title: 'Carnegie Mellon University',
        meta: 'B.S. Statistics & Machine Learning, Minor in Computer Science',
        summary: 'Came in as a bio major and rediscovered programming and algorithms here.',
        details: [
          '15-150: Functional Programming (SML)',
          '15-122: Data Structures & Algorithms (C)',
          '21-127: Discrete Math & Proofs',
          '21-241: Linear Algebra',
          '36-225: Probability Theory',
          '36-202: Statistics & Data Science (R)',
        ],
      },
    ],
  },

  {
    id: 'skills',
    title: 'Skills',
    nodes: [
      {
        title: 'ML / Data',
        details: ['Python (PyTorch, OpenCV, NumPy, Pandas, Matplotlib, Scikit-Learn), R, SQL, HuggingFace, XGBoost'],
      },
      {
        title: 'Bio / Computational',
        details: ['Biopython, breseq, BLAST, whole-genome sequencing, label-free imaging'],
      },
      {
        title: 'Systems / General',
        details: ['C, JavaScript, SML, HTML, Git/GitHub, Unix/Linux, Apache Spark, Anthropic SDK'],
      },
      {
        title: 'Languages',
        details: ['English, Mandarin, Cantonese'],
      },
    ],
  },

  {
    id: 'projects',
    title: 'Projects',
    nodes: [
      {
        title: 'Generative Omics',
        meta: 'Synthetic Microbiological Data Engine · PyTorch, ControlNet · Jul 2026 – Present',
        summary: 'Can fake microscopy images train a real model? I measure real micrographs, use those numbers to generate new images, and test whether they actually help a segmentation model.',
        details: [
          'Built a pipeline quantifying biological parameters from seed micrograph data to drive GenAI-generated imagery, with full measured/cited/default provenance and validation against real-world data',
          'Designed an LLM research API client (Anthropic SDK, 40+ mocked tests) with hard staging invariants blocking unreviewed findings, and diagnosed methodology-invalidating bugs via statistical validation',
          'Currently benchmarking synthetic data utility via segmentation model training against real-data baselines',
        ],
      },
      {
        title: 'Bacteria Bouncer',
        meta: 'Biofilm Imaging Pipeline · OpenCV, Multiprocessing · Jan – Mar 2026',
        summary: 'A tool that watches biofilms grow across time-lapse microscopy, and knows to ignore the debris that just sits there.',
        details: [
          'Built a pipeline quantifying bacterial biomass over time from 16-bit brightfield TIF microscopy, correcting stage drift using coordinates parsed from image metadata',
          'Designed a temporal artifact-rejection method that decays first-frame debris masks unless sustained by neighboring detections, separating static junk from growing biomass',
          'Parallelized per-well analysis across CPU cores with a cancellable process pool and a desktop GUI',
        ],
      },
      {
        title: 'MiniMotorwayer',
        meta: 'Autonomous Agent & Vision Pipeline · OpenCV · Oct 2025 – Jan 2026',
        summary: "A bot that reads the game straight off the screen, works out what's going on, and plans its moves on its own.",
        details: [
          'CV pipeline turning screen captures into a structured game-state model via contour analysis and color classification',
          'Modular dynamic A* pathfinding to automate solutions',
        ],
      },
    ],
  },

  {
    id: 'experience',
    title: 'Experience',
    nodes: [
      {
        title: 'Netramind Innovations',
        meta: 'Machine Learning Engineer Intern · Pittsburgh, PA · Jun 2026 – Present',
        summary: "I'm helping predict how well patients can see at each point of the retina from their OCT scans. That first meant getting two very different kinds of eye scan to line up.",
        details: [
          'Trained an XGBoost model predicting per-stimulus microperimetry sensitivity from retinal OCT-derived features (17,026 stimuli, 112 patients), cutting pooled MAE 13% (3.45 to 3.01 dB) under patient-grouped 10-fold CV',
          'Built a PyTorch/OpenCV image-registration pipeline aligning microperimetry and OCT scans via feature matching, RANSAC affine estimation, and thin-plate-spline warping, registering 18,907 points for the downstream model',
          'Superseded a classical SIFT baseline with a learned ALIKED + LightGlue matcher, raising mean RANSAC inliers ~8.1x (78 to 632) and enabling a denser, better-conditioned TPS warp',
        ],
      },
      {
        title: 'Bridges Lab, CMU',
        meta: 'Undergraduate Research Assistant · Pittsburgh, PA · Jan 2026 – Present',
        summary: 'I train models to tell how bacteria are responding to antibiotics just from how they look under a microscope, with no stains or labels. I also dig through the genomes of *V. cholerae* lineages evolved in the lab.',
        details: [
          'Built deep learning and XGBoost classifiers on 300+GB of label-free brightfield imaging to identify signals of antibiotic response in *S. pneumoniae*, distinguishing cell envelope disruption, metabolic inhibition, and other mechanisms',
          'Developed breseq-based scripts to align whole-genome sequencing reads from 6 evolved *V. cholerae* lineages to a reference genome, identifying 243 mutations linked to adaptive laboratory evolution',
          'Implemented a data visualization pipeline that transforms raw experimental CSV data into publication-ready plots using Matplotlib, reducing manual processing time and improving turnaround for lab reporting',
        ],
      },
    ],
  },

  {
    id: 'leadership',
    title: 'Leadership & awards',
    nodes: [
      {
        title: 'TartanHacks',
        meta: '1st Place, Axon/AppLovin Track · Feb 2026',
        summary: 'Won our track with a fully playable game that fits in 15KB.',
        details: [
          'Competed with 1,050+ competitors; selected as top project for memory efficiency and technical optimization by building a fully functional interactive game in HTML/JS under a strict 15KB constraint',
        ],
      },
      {
        title: 'Hong Kong Student Association',
        meta: 'President, Carnegie Mellon University · Aug 2026 – Present',
        summary: "I lead CMU's Hong Kong Student Association: 273 members and a budget of just over $6,000.",
      },
    ],
  },

  {
    id: 'hobbies',
    title: 'Hobbies',
    note: 'fit to the residual',
    nodes: [
      { title: 'Basketball', summary: 'Playing it.' },
      { title: 'NBA & NFL', summary: 'Watching them.' },
      { title: 'Video games', summary: 'Occasionally.' },
    ],
  },
];

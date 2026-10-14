// All text on the site lives here. Edit freely; no layout code needed.
//
// Each section is revealed by one layer tile (see `layer`); `short` is its
// name in the bottom nav and the network's score panel. Applying the
// tile again reveals the section in more depth:
//   depth 1  every item's `title` and `meta`
//   depth 2  + each item's `summary`
//   depth 3  + each item's `details` bullets
// An item with `depth: n` only appears once the section reaches depth n.
// Wrap text in *asterisks* to italicize it (e.g. species names).

export const SITE = {
  name: 'Alan Dong',
  subtitle: 'AI/ML for Bio',
  // Shown under the name on the content page. One string per paragraph.
  intro: [
    "I've been coding for as long as I can remember. My dad is a lifelong programmer, so it was always around. Then I fell in love with biology in high school and came to CMU as a bio major, where I rediscovered programming and algorithms.",
    "Now I work where the two meet: computer vision and machine learning for biological and medical images. I've stayed close to bio because I want what I build to do some good. Next, I'm taking these skills into real-world work through industry, and maybe a PhD after that.",
    "Off the clock: basketball, the NBA and NFL, and the occasional video game.",
  ],
  // The alternative network input: a public-domain micrograph.
  micrograph: {
    src: 'assets/micrograph-cdc-25235.jpg',
    alt: 'Phase-contrast micrograph of a Clostridium botulinum microcolony',
    credit: 'Micrograph: CDC/Dr. Lillian V. Holdeman, PHIL #25235 (public domain)',
    href: 'https://wwwn.cdc.gov/phil/Details.aspx?pid=25235',
  },
};

export const SECTIONS = [
  {
    id: 'projects',
    short: 'Projects',
    title: "Things I've built",
    layer: 'edges',
    items: [
      {
        title: 'Generative Omics: Synthetic Microbiological Data Engine',
        meta: 'PyTorch, ControlNet · Jul 2026 – Present',
        summary: 'Can fake microscopy images train a real model? I measure real micrographs, use those numbers to generate new images, and test whether they actually help a segmentation model.',
        details: [
          'Built a pipeline quantifying biological parameters from seed micrograph data to drive GenAI-generated imagery, with full measured/cited/default provenance and validation against real-world data',
          'Designed an LLM research API client (Anthropic SDK, 40+ mocked tests) with hard staging invariants blocking unreviewed findings, and diagnosed methodology-invalidating bugs via statistical validation',
          'Currently benchmarking synthetic data utility via segmentation model training against real-data baselines',
        ],
      },
      {
        title: 'Bacteria Bouncer: Biofilm Imaging Pipeline',
        meta: 'OpenCV, Multiprocessing · Jan 2026 – Mar 2026',
        summary: 'A tool that watches biofilms grow across time-lapse microscopy, and knows to ignore the debris that just sits there.',
        details: [
          'Built a pipeline quantifying bacterial biomass over time from 16-bit brightfield TIF microscopy, correcting stage drift using coordinates parsed from image metadata',
          'Designed a temporal artifact-rejection method that decays first-frame debris masks unless sustained by neighboring detections, separating static junk from growing biomass',
          'Parallelized per-well analysis across CPU cores with a cancellable process pool and a desktop GUI',
        ],
      },
      {
        title: 'MiniMotorwayer: Autonomous Agent & Vision Pipeline',
        meta: 'OpenCV · Oct 2025 – Jan 2026',
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
    short: 'Experience',
    title: "Where I've worked",
    layer: 'sharpen',
    items: [
      {
        title: 'Machine Learning Engineer Intern',
        meta: 'Netramind Innovations · Pittsburgh, PA · Jun 2026 – Present',
        summary: "I'm helping predict how well patients can see at each point of the retina from their OCT scans. That first meant getting two very different kinds of eye scan to line up.",
        details: [
          'Trained an XGBoost model predicting per-stimulus microperimetry sensitivity from retinal OCT-derived features (17,026 stimuli, 112 patients), cutting pooled MAE 13% (3.45 to 3.01 dB) under patient-grouped 10-fold CV',
          'Built a PyTorch/OpenCV image-registration pipeline aligning microperimetry and OCT scans via feature matching, RANSAC affine estimation, and thin-plate-spline warping, registering 18,907 points for the downstream model',
          'Superseded a classical SIFT baseline with a learned ALIKED + LightGlue matcher, raising mean RANSAC inliers ~8.1x (78 to 632) and enabling a denser, better-conditioned TPS warp',
        ],
      },
      {
        title: 'Undergraduate Research Assistant',
        meta: 'Bridges Lab, Carnegie Mellon University · Pittsburgh, PA · Jan 2026 – Present',
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
    id: 'skills',
    short: 'Skills',
    title: 'What I know',
    layer: 'blur',
    items: [
      {
        title: 'Carnegie Mellon University',
        meta: 'B.S. Statistics & Machine Learning, Minor in Computer Science',
        summary: 'Coursework so far: functional programming, data structures, proofs, linear algebra, probability, and statistics.',
        details: [
          '15-150: Functional Programming (SML)',
          '15-122: Data Structures & Algorithms (C)',
          '21-127: Discrete Math & Proofs',
          '21-241: Linear Algebra',
          '36-225: Probability Theory',
          '36-202: Statistics & Data Science (R)',
        ],
      },
      {
        title: 'ML / Data',
        meta: 'Python · PyTorch · OpenCV · XGBoost',
        summary: 'Python (PyTorch, OpenCV, NumPy, Pandas, Matplotlib, Scikit-Learn), R, SQL, HuggingFace, XGBoost',
      },
      {
        title: 'Bio / Computational',
        meta: 'Biopython · breseq · label-free imaging',
        summary: 'Biopython, breseq, BLAST, whole-genome sequencing, label-free imaging',
      },
      {
        title: 'Systems / General',
        meta: 'C · JavaScript · Git · Unix/Linux',
        summary: 'C, JavaScript, SML, HTML, Git/GitHub, Unix/Linux, Apache Spark, Anthropic SDK',
      },
      {
        title: 'Languages',
        meta: 'English · Mandarin · Cantonese',
        depth: 3,
      },
    ],
  },

  {
    id: 'awards',
    short: 'Awards',
    title: 'Wins & leadership',
    layer: 'emboss',
    items: [
      {
        title: '1st Place, Axon/AppLovin Track, TartanHacks',
        meta: 'Carnegie Mellon University · Feb 2026',
        summary: 'Won our track at TartanHacks with a fully playable game that fits in 15KB.',
        details: [
          'Competed with 1,050+ competitors; selected as top project for memory efficiency and technical optimization by building a fully functional interactive game in HTML/JS under a strict 15KB constraint',
        ],
      },
      {
        title: 'President, Hong Kong Student Association',
        meta: 'Carnegie Mellon University · Aug 2026 – Present',
        summary: "I lead CMU's Hong Kong Student Association: 273 members and a budget of just over $6,000.",
        details: [
          'Lead a 273-member student organization, overseeing an annual budget exceeding $6,000',
        ],
      },
    ],
  },

  {
    id: 'contact',
    short: 'Contact',
    title: 'Say hi',
    layer: 'softmax',
    items: [
      { title: 'Email', meta: 'awdong@andrew.cmu.edu', href: 'mailto:awdong@andrew.cmu.edu' },
      { title: 'LinkedIn', meta: 'linkedin.com/in/alan-w-dong', href: 'https://www.linkedin.com/in/alan-w-dong' },
      { title: 'GitHub', meta: 'github.com/wenkwonk', href: 'https://github.com/wenkwonk' },
    ],
  },
];

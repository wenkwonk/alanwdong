// All text on the site lives here. Edit freely; no layout code needed.
//
// Each section is revealed by one layer tile (see `layer`). Applying the
// tile again reveals the section in more depth:
//   depth 1  every item's `title` and `meta`
//   depth 2  + each item's `summary`
//   depth 3  + each item's `details` bullets
// An item with `depth: n` only appears once the section reaches depth n.
// Wrap text in *asterisks* to italicize it (e.g. species names).

export const SITE = {
  name: 'Alan Dong',
  subtitle: 'ML for biological images.',
  hintDrag: 'Drag layers into your network, then press Run.',
  hintTap: 'Tap layers to add them, then press Run.',
};

export const SECTIONS = [
  {
    id: 'projects',
    title: 'Projects',
    layer: 'edges',
    items: [
      {
        title: 'Generative Omics: Synthetic Microbiological Data Engine',
        meta: 'PyTorch, ControlNet · Jul 2026 – Present',
        summary: 'Measures biological parameters from real micrographs to drive generated microscopy images, then tests whether that synthetic data helps train segmentation models.',
        details: [
          'Built a pipeline quantifying biological parameters from seed micrograph data to drive GenAI-generated imagery, with full measured/cited/default provenance and validation against real-world data',
          'Designed an LLM research API client (Anthropic SDK, 40+ mocked tests) with hard staging invariants blocking unreviewed findings, and diagnosed methodology-invalidating bugs via statistical validation',
          'Currently benchmarking synthetic data utility via segmentation model training against real-data baselines',
        ],
      },
      {
        title: 'Bacteria Bouncer: Biofilm Imaging Pipeline',
        meta: 'OpenCV, Multiprocessing · Jan 2026 – Mar 2026',
        summary: 'Measures bacterial biomass over time from brightfield microscopy, separating real growth from static debris.',
        details: [
          'Built a pipeline quantifying bacterial biomass over time from 16-bit brightfield TIF microscopy, correcting stage drift using coordinates parsed from image metadata',
          'Designed a temporal artifact-rejection method that decays first-frame debris masks unless sustained by neighboring detections, separating static junk from growing biomass',
          'Parallelized per-well analysis across CPU cores with a cancellable process pool and a desktop GUI',
        ],
      },
      {
        title: 'MiniMotorwayer: Autonomous Agent & Vision Pipeline',
        meta: 'OpenCV · Oct 2025 – Jan 2026',
        summary: 'Reads game state from screen captures and plans solutions automatically.',
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
    layer: 'sharpen',
    items: [
      {
        title: 'Machine Learning Engineer Intern',
        meta: 'Netramind Innovations · Pittsburgh, PA · Jun 2026 – Present',
        summary: 'Predicting microperimetry sensitivity from retinal OCT features, and registering the two scan types so the model can use them.',
        details: [
          'Trained an XGBoost model predicting per-stimulus microperimetry sensitivity from retinal OCT-derived features (17,026 stimuli, 112 patients), cutting pooled MAE 13% (3.45 to 3.01 dB) under patient-grouped 10-fold CV',
          'Built a PyTorch/OpenCV image-registration pipeline aligning microperimetry and OCT scans via feature matching, RANSAC affine estimation, and thin-plate-spline warping, registering 18,907 points for the downstream model',
          'Superseded a classical SIFT baseline with a learned ALIKED + LightGlue matcher, raising mean RANSAC inliers ~8.1x (78 to 632) and enabling a denser, better-conditioned TPS warp',
        ],
      },
      {
        title: 'Undergraduate Research Assistant',
        meta: 'Bridges Lab, Carnegie Mellon University · Pittsburgh, PA · Jan 2026 – Present',
        summary: 'Classifying antibiotic response in bacteria from label-free microscopy, and analyzing genomes of evolved *V. cholerae* lineages.',
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
    title: 'Skills & coursework',
    layer: 'blur',
    items: [
      {
        title: 'Carnegie Mellon University',
        meta: 'B.S. Statistics & Machine Learning, Minor in Computer Science · GPA 3.76/4.0 · May 2029',
        summary: 'Relevant coursework in functional programming, data structures, proofs, linear algebra, probability, and statistics.',
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
    title: 'Awards & leadership',
    layer: 'emboss',
    items: [
      {
        title: '1st Place, Axon/AppLovin Track, TartanHacks',
        meta: 'Carnegie Mellon University · Feb 2026',
        summary: 'Top project for memory efficiency: a fully functional HTML/JS game under 15KB.',
        details: [
          'Competed with 1,050+ competitors; selected as top project for memory efficiency and technical optimization by building a fully functional interactive game in HTML/JS under a strict 15KB constraint',
        ],
      },
      {
        title: 'President, Hong Kong Student Association',
        meta: 'Carnegie Mellon University · Aug 2026 – Present',
        summary: 'Leading a 273-member student organization.',
        details: [
          'Lead a 273-member student organization, overseeing an annual budget exceeding $6,000',
        ],
      },
    ],
  },

  {
    id: 'contact',
    title: 'Contact',
    layer: 'softmax',
    items: [
      { title: 'Email', meta: 'awdong@andrew.cmu.edu', href: 'mailto:awdong@andrew.cmu.edu' },
      { title: 'LinkedIn', meta: 'linkedin.com/in/alan-w-dong', href: 'https://www.linkedin.com/in/alan-w-dong' },
      { title: 'GitHub', meta: 'github.com/wenkwonk', href: 'https://github.com/wenkwonk' },
    ],
  },
];

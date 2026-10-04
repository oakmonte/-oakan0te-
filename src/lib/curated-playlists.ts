// Oakmonte's curated YouTube playlists, snapshotted from the public playlists
// on Oakmonte's own channel. Videos are listed here (not fetched live) so the
// pages need no YouTube API key and render instantly; re-snapshot a playlist
// when its contents change. Only add a playlist after checking it is public and
// ours -- the rest of that channel is private on purpose.
export type CuratedVideo = { id: string; title: string; channel: string };
export type CuratedPlaylist = {
  id: string;
  title: string;
  blurb: string;
  videos: CuratedVideo[];
};

export const CURATED_PLAYLISTS: CuratedPlaylist[] = [
  {
    id: "PLDzTvKP_2IEQ",
    title: "The Art Of Fashion Design",
    blurb: "Design thinking, taste and creative direction.",
    videos: [
      { id: "wjOMFo_026A", title: "Every Fashion Designer, Explained", channel: "Bliss Foster" },
      {
        id: "8MzPLXbNOeQ",
        title: 'What exactly is the "taste economy"?',
        channel: "orenmeetsworld",
      },
      {
        id: "k8R8d0xWskk",
        title: "The Art Direction of Modern Streetwear",
        channel: "orenmeetsworld",
      },
      {
        id: "up2BLatM1EY",
        title: "Boy Internet vs Girl Internet (algorithms explained)",
        channel: "orenmeetsworld",
      },
      {
        id: "mhfVCsfW968",
        title: "The creative direction playbook for brands (Rhode case study)",
        channel: "orenmeetsworld",
      },
      { id: "4bOri-8SUKo", title: "SA FASHION BRANDS EXPLAINED!", channel: "blunt2cool" },
      {
        id: "p6aF5ma7BiM",
        title: "How Brands Use Design & Marketing to Control Your Mind",
        channel: "Design Theory",
      },
    ],
  },
  {
    id: "PLEBrtm36S40I",
    title: "A Complete Guide to Grow Your Clothing Brand in 2026",
    blurb: "Starting, costing and scaling a clothing brand.",
    videos: [
      {
        id: "Bn6na0e2IUg",
        title: "How to Build a Cult-Like Clothing Brand on Social Media",
        channel: "Marshall Crews",
      },
      {
        id: "UcLBvcmnnus",
        title: "7 Levels Of Fashion Explained ( %99 Stuck At Level 3)",
        channel: "Jaye Alexander",
      },
      {
        id: "X9mvDIJiORA",
        title: "How To ACTUALLY Start a Clothing Brand in 2026 (THE TRUTH)",
        channel: "Caprice",
      },
      {
        id: "xpVJCVE2qeA",
        title: "How To Start A Clothing brand in Nigeria (2025)",
        channel: "Absa Worldwide",
      },
      {
        id: "xl5a--Wuask",
        title: "Seriously, Please Watch This Before You Start a Clothing Brand in 2026",
        channel: "Marshall Crews",
      },
      {
        id: "HzI4m5jvBkg",
        title: "3 years of Building a Fashion Brand in 28 mins",
        channel: "Ken Sakata",
      },
      {
        id: "SeLjuYyQ7g0",
        title: "How I Would Start a Clothing Brand in 2026 (If I could start over)",
        channel: "Marshall Crews",
      },
      {
        id: "Cg0R61DPddg",
        title: "The Realistic Cost of Starting A Clothing Brand",
        channel: "Absa Worldwide",
      },
      {
        id: "fuVU64m1sbw",
        title: "How to Identify Quality in Clothing (A Rant)",
        channel: "Bernadette Banner",
      },
      {
        id: "fn5zRAooA8o",
        title: "How To Get Ahead Of 99% Of Clothing Brands In 2025",
        channel: "Marshall Crews",
      },
      {
        id: "1VvWghTOeSU",
        title: "Why Nigerian Tailors Make More Money Than Famous Fashion Designers - Mai Atafo",
        channel: "Afropolitan",
      },
      {
        id: "6r82EmpIb7s",
        title: "The world building playbook for brands",
        channel: "orenmeetsworld",
      },
    ],
  },
  {
    id: "PLfiJ5EMynbpE",
    title: "Marketing guide for fashion sellers",
    blurb: "Branding, audience and what makes people buy.",
    videos: [
      {
        id: "8tMm_XZA0HU",
        title: "Marketing Your Clothing Brand is Simple, Actually (FREE COURSE)",
        channel: "Marshall Crews",
      },
      {
        id: "VkECvreqWRc",
        title: "5 Effective Marketing Strategies To Get More Sales As A Small Fashion Business",
        channel: "Kim Dave",
      },
      {
        id: "X-gponwGF6w",
        title: "How to CORRECTLY Market Your Clothing Brand in 3 Easy Steps",
        channel: "WRLDINVSN Network",
      },
      {
        id: "dJR7OpkEeBk",
        title: "8 DARK PSYCHOLOGY Sales Techniques to Sell Anything",
        channel: "Patrick Dang",
      },
      {
        id: "BFySLXzfm0A",
        title: "The Neuroscience Behind Becoming a Marketing Genius",
        channel: "orenmeetsworld",
      },
      {
        id: "DWDFRi5ONMI",
        title: "How to Be a 1-Person Marketing Machine in 2026",
        channel: "orenmeetsworld",
      },
      {
        id: "RmwI_QqcPQc",
        title: "How To Market Your Business On Social Media",
        channel: "Marley Jaxx",
      },
      {
        id: "l3inbx2jeZU",
        title: "What ACTUALLY Makes People Buy Things (Pricing Psychology Explained)",
        channel: "orenmeetsworld",
      },
      {
        id: "sO4te2QNsHY",
        title: "What Is Branding? 4 Minute Crash Course.",
        channel: "The Futur",
      },
      {
        id: "Z377Lq0jrx4",
        title:
          "You need to build an audience BEFORE you launch your fashion brand (let me show you how)",
        channel: "Alice Oluyitan",
      },
      {
        id: "rhP-S30Rmqo",
        title: "Marketing a Clothing Brand in 2026 is Simple, Actually (FREE COURSE)",
        channel: "Rayinthedarkk",
      },
      {
        id: "hRWOsZbsCD0",
        title: "This Exact Strategy Sells Out Clothing Brand Drops Every Single Time",
        channel: "Mr. BeSpecial",
      },
      {
        id: "yHGRBTZI6w0",
        title: "The Art of Marketing \u2014 for Good | Raja Rajamannar | TED",
        channel: "TED",
      },
      {
        id: "8zcnK6Lx_p4",
        title:
          "Marketing Godfather: How To Build An Audience That Buys (Best Hour You\u2019ll Spend Today!) | Seth Godin",
        channel: "The Calum Johnson Show",
      },
      {
        id: "UlfniLzuwa0",
        title: "The Only Marketing Strategy That Is Working In 2026",
        channel: "Neil Patel",
      },
      {
        id: "6r5aCyNKAOI",
        title: "Marketing GENIUS: The Strategy Behind Content That Reaches Millions",
        channel: "The Anatomy of a Dream",
      },
    ],
  },
  {
    id: "PLM1-PS_fS4eA",
    title: "HOW I... For Fashion Brands",
    blurb: "Founders breaking down how they built their brands.",
    videos: [
      {
        id: "M68aNF_vBMw",
        title: "How I Built One Of Europe's Biggest Clothing Brands",
        channel: "The Numbers Game",
      },
      {
        id: "9CTigCTKGDE",
        title: "I Stole Supreme's Marketing Strategy And Made $100K With My Clothing Brand",
        channel: "Marshall Crews",
      },
      {
        id: "ItFE29E71EU",
        title: "I Copied Chrome Heart's $1.5 Billion Clothing Brand Strategy (It worked)",
        channel: "Marshall Crews",
      },
      {
        id: "n_bavpiO4Bk",
        title: "Aimee Smale: How I Built A $5M/Year Clothing Brand",
        channel: "The Numbers Game",
      },
    ],
  },
  {
    id: "PLVot20Llm6IA",
    title: "How To Get The Best Manufacturer For Your Clothing Brand",
    blurb: "Finding, talking to and working with manufacturers.",
    videos: [
      {
        id: "aNZ3iJltgqQ",
        title: "How to Find the Best Manufacturer for your Clothing Brand in 2025",
        channel: "Marshall Crews",
      },
      {
        id: "i47CE_LLoCM",
        title: "How To Talk To Clothing Brand Manufacturers",
        channel: "Mr. BeSpecial",
      },
      {
        id: "ycd6S73aa28",
        title: "how to design clothes for your clothing brand",
        channel: "eban corona",
      },
    ],
  },
];

export const thumbUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

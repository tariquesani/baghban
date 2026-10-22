const PLANT_CATALOG = [
  {
    "name": "🍅 Tomatoes",
    "category": "Vegetables",
    "emoji": "🍅",
    "sqft": 4,
    "spacing": 24,
    "depthIn": 12,
    "sun": "Full",
    "water": "High",
    "trellis": false,
    "notes": "Stake or cage. Deep roots — 12″+ soil.",
    "companions": [
      "🌿 Basil",
      "🧅 Onions"
    ],
    "avoid": [
      "🥦 Broccoli"
    ]
  },
  {
    "name": "🌶️ Hot Peppers",
    "category": "Vegetables",
    "emoji": "🌶️",
    "sqft": 1,
    "spacing": 18,
    "depthIn": 8,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Loves heat. Cage to support heavy fruits.",
    "companions": [
      "🌿 Basil",
      "🌿 Chives",
      "🌼 Marigolds",
      "🌿 Oregano",
      "🥕 Carrots"
    ],
    "avoid": [
      "🥦 Broccoli",
      "🫛 Green Beans"
    ]
  },
  {
    "name": "🫑 Bell Peppers",
    "category": "Vegetables",
    "emoji": "🫑",
    "sqft": 1,
    "spacing": 18,
    "depthIn": 8,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Needs warm soil. Stake when heavy with fruit.",
    "companions": [
      "🌿 Basil",
      "🌿 Chives",
      "🌼 Marigolds"
    ],
    "avoid": [
      "🥦 Broccoli"
    ]
  },
  {
    "name": "🍆 Eggplant",
    "category": "Vegetables",
    "emoji": "🍆",
    "sqft": 2,
    "spacing": 18,
    "depthIn": 8,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Loves heat. Stake tall varieties. Repels aphids with foil mulch.",
    "companions": [
      "🌿 Basil",
      "🌼 Marigolds"
    ],
    "avoid": []
  },
  {
    "name": "🥒 Cucumbers",
    "category": "Vegetables",
    "emoji": "🥒",
    "sqft": 2,
    "spacing": 12,
    "depthIn": 8,
    "sun": "Full",
    "water": "High",
    "trellis": true,
    "notes": "Trellis required. Keep soil evenly moist.",
    "companions": [
      "🌿 Dill",
      "🧅 Onions",
      "🌼 Marigolds",
      "🌸 Nasturtiums",
      "🌻 Sunflowers",
      "🌱 Radishes"
    ],
    "avoid": [
      "🌿 Rosemary",
      "🌿 Sage"
    ]
  },
  {
    "name": "🎃 Squash",
    "category": "Vegetables",
    "emoji": "🎃",
    "sqft": 9,
    "spacing": 36,
    "depthIn": 8,
    "sun": "Full",
    "water": "High",
    "trellis": false,
    "notes": "Sprawling — place at bed edge to drape over.",
    "companions": [
      "🌿 Dill"
    ],
    "avoid": []
  },
  {
    "name": "🌽 Corn",
    "category": "Vegetables",
    "emoji": "🌽",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 8,
    "sun": "Full",
    "water": "High",
    "trellis": false,
    "notes": "Plant in blocks (4+ rows) for wind pollination.",
    "companions": [
      "🎃 Squash",
      "🫛 Green Beans"
    ],
    "avoid": []
  },
  {
    "name": "🥕 Carrots",
    "category": "Vegetables",
    "emoji": "🥕",
    "sqft": 1,
    "spacing": 3,
    "depthIn": 12,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Needs 12″+ loose soil. Thin seedlings to 3″.",
    "companions": [
      "🌿 Rosemary",
      "🧅 Onions"
    ],
    "avoid": [
      "🥦 Broccoli"
    ]
  },
  {
    "name": "🥔 Potatoes",
    "category": "Vegetables",
    "emoji": "🥔",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 12,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Hill up soil as plants grow. Harvest after tops die back.",
    "companions": [
      "🌿 Basil",
      "🧅 Onions"
    ],
    "avoid": [
      "🍅 Tomatoes"
    ]
  },
  {
    "name": "🍠 Sweet Potatoes",
    "category": "Vegetables",
    "emoji": "🍠",
    "sqft": 4,
    "spacing": 18,
    "depthIn": 8,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Sprawling vines. Very drought-tolerant once established.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🥬 Lettuce",
    "category": "Vegetables",
    "emoji": "🥬",
    "sqft": 0.25,
    "spacing": 6,
    "depthIn": 6,
    "sun": "Full/Part",
    "water": "Medium",
    "trellis": false,
    "notes": "4 per sq ft. Harvest outer leaves first.",
    "companions": [
      "🥕 Carrots",
      "🌿 Mint"
    ],
    "avoid": []
  },
  {
    "name": "🌱 Spinach",
    "category": "Vegetables",
    "emoji": "🌱",
    "sqft": 0.11,
    "spacing": 3,
    "depthIn": 6,
    "sun": "Full/Part",
    "water": "Medium",
    "trellis": false,
    "notes": "9 per sq ft. Great for cool seasons.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🥦 Broccoli",
    "category": "Vegetables",
    "emoji": "🥦",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 8,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "1 plant per sq ft. Watch for caterpillars.",
    "companions": [],
    "avoid": [
      "🍅 Tomatoes",
      "🌶️ Hot Peppers"
    ]
  },
  {
    "name": "🫛 Green Beans",
    "category": "Vegetables",
    "emoji": "🫛",
    "sqft": 1,
    "spacing": 6,
    "depthIn": 8,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Bush variety needs no support.",
    "companions": [
      "🥕 Carrots"
    ],
    "avoid": [
      "🧅 Onions"
    ]
  },
  {
    "name": "🫘 Edamame",
    "category": "Vegetables",
    "emoji": "🫘",
    "sqft": 0.25,
    "spacing": 6,
    "depthIn": 6,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Harvest when pods are plump and bright green.",
    "companions": [],
    "avoid": [
      "🧅 Onions"
    ]
  },
  {
    "name": "🧅 Onions",
    "category": "Vegetables",
    "emoji": "🧅",
    "sqft": 0.25,
    "spacing": 4,
    "depthIn": 8,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "16 per sq ft. Plant sets 1″ deep.",
    "companions": [
      "🍅 Tomatoes",
      "🌶️ Hot Peppers"
    ],
    "avoid": [
      "🫛 Green Beans"
    ]
  },
  {
    "name": "🧄 Garlic",
    "category": "Vegetables",
    "emoji": "🧄",
    "sqft": 0.25,
    "spacing": 6,
    "depthIn": 8,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Plant cloves 2″ deep in fall; harvest in summer. Repels aphids and pests.",
    "companions": [
      "🍅 Tomatoes",
      "🌹 Roses",
      "🥕 Carrots"
    ],
    "avoid": [
      "🫛 Green Beans",
      "🌿 Sage"
    ]
  },
  {
    "name": "🌱 Radishes",
    "category": "Vegetables",
    "emoji": "🌱",
    "sqft": 0.11,
    "spacing": 3,
    "depthIn": 6,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Fast (25 days). Plant at base of cucumbers to deter beetles. Pull before they crowd.",
    "companions": [
      "🥒 Cucumbers",
      "🥕 Carrots",
      "🌸 Nasturtiums"
    ],
    "avoid": [
      "🥦 Broccoli"
    ]
  },
  {
    "name": "🌱 Vegetable",
    "category": "Vegetables",
    "emoji": "🌱",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 8,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Generic vegetable — update spacing and depth for your variety.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🌿 Basil",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 6,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Pinch flowers to extend harvest.",
    "companions": [
      "🍅 Tomatoes",
      "🌶️ Hot Peppers"
    ],
    "avoid": [
      "🌿 Dill"
    ]
  },
  {
    "name": "🌿 Chives",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 0.25,
    "spacing": 6,
    "depthIn": 6,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Repels aphids & spider mites. Divide clumps every 3 years.",
    "companions": [
      "🌶️ Hot Peppers",
      "🍅 Tomatoes",
      "🥕 Carrots"
    ],
    "avoid": []
  },
  {
    "name": "🌿 Parsley",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 0.25,
    "spacing": 6,
    "depthIn": 6,
    "sun": "Full/Part",
    "water": "Medium",
    "trellis": false,
    "notes": "4 per sq ft. Biennial — replant each year.",
    "companions": [
      "🍅 Tomatoes"
    ],
    "avoid": []
  },
  {
    "name": "🌿 Cilantro",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 0.25,
    "spacing": 6,
    "depthIn": 6,
    "sun": "Full/Part",
    "water": "Medium",
    "trellis": false,
    "notes": "Bolts in heat. Succession-plant every 3 weeks.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🌿 Thyme",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 6,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Drought-tolerant once established.",
    "companions": [
      "🍓 Strawberries",
      "🍅 Tomatoes"
    ],
    "avoid": []
  },
  {
    "name": "🌿 Oregano",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 6,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Spreads aggressively. Consider a sunken pot.",
    "companions": [
      "🌶️ Hot Peppers"
    ],
    "avoid": []
  },
  {
    "name": "🌿 Mint",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 6,
    "sun": "Full/Part",
    "water": "Medium",
    "trellis": false,
    "notes": "Very invasive — sink a buried pot into the bed.",
    "companions": [
      "🥬 Lettuce"
    ],
    "avoid": []
  },
  {
    "name": "🌿 Rosemary",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 4,
    "spacing": 24,
    "depthIn": 8,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Perennial. Great corner or border plant.",
    "companions": [
      "🥕 Carrots"
    ],
    "avoid": [
      "🥒 Cucumbers"
    ]
  },
  {
    "name": "🌿 Dill",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 1,
    "spacing": 6,
    "depthIn": 8,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Tall — plant at north end so it doesn't shade.",
    "companions": [
      "🥒 Cucumbers",
      "🎃 Squash"
    ],
    "avoid": [
      "🌿 Basil"
    ]
  },
  {
    "name": "🌿 Sage",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 1,
    "spacing": 18,
    "depthIn": 6,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Woody perennial. Trim after blooming to keep bushy. Repels cabbage moths.",
    "companions": [
      "🥦 Broccoli",
      "🥕 Carrots"
    ],
    "avoid": [
      "🥒 Cucumbers",
      "🧄 Garlic"
    ]
  },
  {
    "name": "🌾 Lemongrass",
    "category": "Herbs",
    "emoji": "🌾",
    "sqft": 4,
    "spacing": 24,
    "depthIn": 8,
    "sun": "Full",
    "water": "High",
    "trellis": false,
    "notes": "Tender perennial — plant after last frost, or overwinter a pot indoors. Space 2 ft in a bed; a happy clump can reach 3 ft wide. Keep soil moist and well drained. Harvest outer stalks at the base.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🌿 Herb",
    "category": "Herbs",
    "emoji": "🌿",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 6,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Generic herb — update spacing and depth for your variety.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🌼 Marigolds",
    "category": "Flowers",
    "emoji": "🌼",
    "sqft": 0.25,
    "spacing": 6,
    "depthIn": 6,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Plant at bed corners/edges. Deters nematodes, aphids & whiteflies.",
    "companions": [
      "🌶️ Hot Peppers",
      "🍅 Tomatoes",
      "🥕 Carrots",
      "🥒 Cucumbers"
    ],
    "avoid": []
  },
  {
    "name": "🌸 Nasturtiums",
    "category": "Flowers",
    "emoji": "🌸",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 6,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Trap crop — aphids prefer them over cucumbers. Flowers & leaves are edible.",
    "companions": [
      "🥒 Cucumbers",
      "🎃 Squash",
      "🍅 Tomatoes"
    ],
    "avoid": []
  },
  {
    "name": "🌻 Sunflowers",
    "category": "Flowers",
    "emoji": "🌻",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 8,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Living trellis for cucumbers. Plant on north side to avoid shading other crops.",
    "companions": [
      "🥒 Cucumbers"
    ],
    "avoid": []
  },
  {
    "name": "🌹 Roses",
    "category": "Flowers",
    "emoji": "🌹",
    "sqft": 4,
    "spacing": 24,
    "depthIn": 12,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Good air circulation prevents disease. Prune in early spring.",
    "companions": [
      "🧄 Garlic",
      "🌿 Chives",
      "🌼 Marigolds"
    ],
    "avoid": []
  },
  {
    "name": "🌷 Tulips",
    "category": "Flowers",
    "emoji": "🌷",
    "sqft": 0.25,
    "spacing": 6,
    "depthIn": 8,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Plant bulbs in fall, 6-8\" deep. Lift and store after foliage dies back.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🌺 Hibiscus",
    "category": "Flowers",
    "emoji": "🌺",
    "sqft": 4,
    "spacing": 24,
    "depthIn": 8,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Tropical types need warm temps. Hardy types can overwinter in zones 5+.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🪷 Lavender",
    "category": "Flowers",
    "emoji": "🪷",
    "sqft": 1,
    "spacing": 18,
    "depthIn": 8,
    "sun": "Full",
    "water": "Low",
    "trellis": false,
    "notes": "Drought-tolerant once established. Excellent pollinator attractor.",
    "companions": [
      "🥦 Broccoli",
      "🌹 Roses"
    ],
    "avoid": []
  },
  {
    "name": "💐 Wildflowers",
    "category": "Flowers",
    "emoji": "💐",
    "sqft": 1,
    "spacing": 6,
    "depthIn": 4,
    "sun": "Full/Part",
    "water": "Low",
    "trellis": false,
    "notes": "Direct-sow mix. Attracts pollinators and beneficial insects.",
    "companions": [
      "🍅 Tomatoes",
      "🥒 Cucumbers"
    ],
    "avoid": []
  },
  {
    "name": "🍓 Strawberries",
    "category": "Fruit",
    "emoji": "🍓",
    "sqft": 1,
    "spacing": 12,
    "depthIn": 6,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Send runners yearly. Refresh plants every 3 years.",
    "companions": [
      "🌿 Thyme"
    ],
    "avoid": [
      "🥦 Broccoli"
    ]
  },
  {
    "name": "🫐 Blueberries",
    "category": "Fruit",
    "emoji": "🫐",
    "sqft": 9,
    "spacing": 48,
    "depthIn": 12,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Need acidic soil (pH 4.5-5.5). Plant 2+ varieties to cross-pollinate.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🍇 Grapes",
    "category": "Fruit",
    "emoji": "🍇",
    "sqft": 9,
    "spacing": 72,
    "depthIn": 12,
    "sun": "Full",
    "water": "Low",
    "trellis": true,
    "notes": "Needs sturdy trellis or arbor. Prune heavily each winter for best fruit.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🍈 Melon",
    "category": "Fruit",
    "emoji": "🍈",
    "sqft": 9,
    "spacing": 36,
    "depthIn": 8,
    "sun": "Full",
    "water": "High",
    "trellis": false,
    "notes": "Needs full sun and a long warm season.",
    "companions": [
      "🌿 Dill"
    ],
    "avoid": []
  },
  {
    "name": "🍉 Watermelon",
    "category": "Fruit",
    "emoji": "🍉",
    "sqft": 12,
    "spacing": 48,
    "depthIn": 8,
    "sun": "Full",
    "water": "High",
    "trellis": false,
    "notes": "Very large vines — give plenty of space at bed edges.",
    "companions": [
      "🌿 Dill"
    ],
    "avoid": []
  },
  {
    "name": "🍎 Apple",
    "category": "Fruit",
    "emoji": "🍎",
    "sqft": 64,
    "spacing": 120,
    "depthIn": 18,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Plant 2+ varieties for pollination. Dwarf trees fit smaller gardens.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🍐 Pear",
    "category": "Fruit",
    "emoji": "🍐",
    "sqft": 64,
    "spacing": 120,
    "depthIn": 18,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Plant 2 varieties for cross-pollination. Harvest before fully ripe.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🍑 Peach",
    "category": "Fruit",
    "emoji": "🍑",
    "sqft": 64,
    "spacing": 120,
    "depthIn": 18,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Self-fertile but yields more with cross-pollination. Thin fruits early.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🍒 Cherries",
    "category": "Fruit",
    "emoji": "🍒",
    "sqft": 64,
    "spacing": 120,
    "depthIn": 18,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Sweet cherries need a pollinator variety. Sour cherries are self-fertile.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🍋 Lemon",
    "category": "Fruit",
    "emoji": "🍋",
    "sqft": 16,
    "spacing": 72,
    "depthIn": 12,
    "sun": "Full",
    "water": "Medium",
    "trellis": false,
    "notes": "Frost-sensitive. Grow in containers in cold climates; bring indoors in winter.",
    "companions": [],
    "avoid": []
  },
  {
    "name": "🥝 Kiwi",
    "category": "Fruit",
    "emoji": "🥝",
    "sqft": 64,
    "spacing": 120,
    "depthIn": 12,
    "sun": "Full",
    "water": "Medium",
    "trellis": true,
    "notes": "Vigorous climber — needs sturdy trellis. Plant 1 male per 6-8 female plants.",
    "companions": [],
    "avoid": []
  }
];

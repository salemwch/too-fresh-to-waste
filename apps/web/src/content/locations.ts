import type { Locale } from '@/i18n/config';

// Local SEO content for Tunisian city landing pages.
//
// These pages target the highest-intent queries we can realistically win:
// "anti gaspi Tunis", "panier surprise Sousse", "أكل رخيص صفاقس". Each city therefore
// carries genuinely distinct copy — real neighbourhoods, real local food
// culture, city-specific FAQs. Templated near-duplicates across cities are
// doorway pages, which Google demotes rather than ranks.
//
// Kept out of messages/*.json deliberately: this is long-form SEO body copy,
// not UI chrome, and shipping it through next-intl would push it into the
// client bundle of every marketing page.

export interface LocalizedText {
  en: string;
  fr: string;
  ar: string;
}

interface CityFaq {
  question: LocalizedText;
  answer: LocalizedText;
}

export interface CityContent {
  /** URL slug — must match the sitemap entry. */
  slug: string;
  name: LocalizedText;
  /** Governorate the city sits in, for LocalBusiness `addressRegion`. */
  region: LocalizedText;
  postalCode: string;
  coordinates: { lat: number; lng: number };
  /** Metres — feeds the `areaServed` GeoCircle in structured data. */
  serviceRadiusMeters: number;
  /** <title>. Front-loaded with the head term, city second. */
  metaTitle: LocalizedText;
  /** <meta description>. Written for click-through, not keyword stuffing. */
  metaDescription: LocalizedText;
  /** <h1>. */
  heading: LocalizedText;
  /** Opening paragraph — the answer-first block Google can lift for snippets. */
  intro: LocalizedText;
  /** Why food waste matters specifically here. Unique per city. */
  localContext: LocalizedText;
  /** Neighbourhoods / districts — the long-tail "anti gaspi [quartier]" surface. */
  neighborhoods: string[];
  /** Local food culture hook — what a surprise bag actually contains here. */
  cuisine: LocalizedText;
  faqs: CityFaq[];
  /** Slugs of other cities, for contextual internal linking. */
  nearby: string[];
}

export const cities: readonly CityContent[] = [
  {
    slug: 'tunis',
    name: { en: 'Tunis', fr: 'Tunis', ar: 'تونس' },
    region: { en: 'Tunis', fr: 'Tunis', ar: 'تونس' },
    postalCode: '1000',
    coordinates: { lat: 36.8065, lng: 10.1815 },
    serviceRadiusMeters: 20000,
    metaTitle: {
      en: 'Anti-Waste Food in Tunis — Surprise Bags from 3 TND',
      fr: 'Anti-Gaspi à Tunis — Paniers Surprise dès 3 TND',
      ar: 'مكافحة هدر الطعام في تونس — سلال مفاجأة من 3 دينار',
    },
    metaDescription: {
      en: 'Rescue unsold food from bakeries, restaurants and grocers across Tunis for up to 70% less. Reserve a surprise bag in the Medina, Lac, Menzah or Marsa and collect it the same day.',
      fr: "Sauvez les invendus des boulangeries, restaurants et épiceries de Tunis jusqu'à -70%. Réservez un panier surprise à la Médina, au Lac, au Menzah ou à La Marsa et récupérez-le le jour même.",
      ar: 'أنقذ الطعام غير المباع من المخابز والمطاعم والبقالات في تونس بخصم يصل إلى 70%. احجز سلة مفاجأة واستلمها في نفس اليوم.',
    },
    heading: {
      en: 'Fight Food Waste in Tunis',
      fr: 'Luttez Contre le Gaspillage Alimentaire à Tunis',
      ar: 'كافح هدر الطعام في تونس',
    },
    intro: {
      en: 'Every evening, bakeries along Avenue Habib Bourguiba, restaurants in the Medina and grocers in Lac 1 and Lac 2 close with perfectly good food unsold. Too Fresh To Waste lets you reserve that food as a surprise bag at up to 70% off and collect it before closing time.',
      fr: "Chaque soir, les boulangeries de l'Avenue Habib Bourguiba, les restaurants de la Médina et les épiceries du Lac 1 et Lac 2 ferment avec des invendus parfaitement consommables. Too Fresh To Waste vous permet de réserver ces produits sous forme de panier surprise jusqu'à -70% et de les récupérer avant la fermeture.",
      ar: 'كل مساء، تغلق المخابز والمطاعم والبقالات في تونس أبوابها ولديها طعام صالح تمامًا لم يُبع. يتيح لك Too Fresh To Waste حجز هذا الطعام كسلة مفاجأة بخصم يصل إلى 70%.',
    },
    localContext: {
      en: 'As the capital and the densest food-retail market in Tunisia, Greater Tunis generates more surplus per square kilometre than anywhere else in the country. The concentration of bakeries, patisseries and quick-service restaurants between the city centre, Bardo and the northern suburbs means a bag is usually available within a short walk of wherever you are.',
      fr: "Capitale et marché alimentaire le plus dense de Tunisie, le Grand Tunis génère davantage d'invendus au kilomètre carré que partout ailleurs dans le pays. La concentration de boulangeries, pâtisseries et restaurants rapides entre le centre-ville, le Bardo et les banlieues nord fait qu'un panier est généralement disponible à quelques minutes à pied.",
      ar: 'باعتبارها العاصمة وأكثر أسواق المواد الغذائية كثافة في تونس، تولد تونس الكبرى فائضًا غذائيًا أكبر من أي منطقة أخرى في البلاد.',
    },
    neighborhoods: [
      'Medina',
      'Lac 1',
      'Lac 2',
      'Menzah',
      'Manar',
      'Bardo',
      'La Marsa',
      'Carthage',
      'Ariana',
      'Ben Arous',
    ],
    cuisine: {
      en: 'Expect baguettes and mlawi from neighbourhood bakeries, briks and lablabi from small restaurants, French-style patisserie from the northern suburbs, and fresh produce from grocers near the central market.',
      fr: 'Attendez-vous à des baguettes et du mlawi des boulangeries de quartier, des briks et du lablabi des petits restaurants, de la pâtisserie française des banlieues nord, et des produits frais des épiceries près du marché central.',
      ar: 'توقع خبزًا طازجًا وملاوي من مخابز الحي، وبريك ولبلابي من المطاعم الصغيرة، وحلويات فرنسية من الضواحي الشمالية.',
    },
    faqs: [
      {
        question: {
          en: 'Which areas of Tunis have the most surprise bags?',
          fr: 'Quels quartiers de Tunis proposent le plus de paniers surprise ?',
          ar: 'ما هي مناطق تونس التي توفر أكبر عدد من السلال؟',
        },
        answer: {
          en: 'The city centre, Lac 1 and Lac 2, Menzah and La Marsa have the highest concentration of partner bakeries and restaurants. Availability is highest between 6pm and closing.',
          fr: 'Le centre-ville, le Lac 1 et Lac 2, le Menzah et La Marsa concentrent le plus de boulangeries et restaurants partenaires. La disponibilité est maximale entre 18h et la fermeture.',
          ar: 'يتركز أكبر عدد من المتاجر الشريكة في وسط المدينة والبحيرة والمنزه والمرسى.',
        },
      },
      {
        question: {
          en: 'How much does a surprise bag cost in Tunis?',
          fr: 'Combien coûte un panier surprise à Tunis ?',
          ar: 'كم تكلفة سلة المفاجأة في تونس؟',
        },
        answer: {
          en: 'Bags in Tunis typically start at 3 TND and contain food worth at least three times the price you pay. Bakery bags sit at the lower end; restaurant and grocery bags cost more but contain more.',
          fr: 'À Tunis, les paniers démarrent généralement à 3 TND et contiennent au moins trois fois la valeur payée. Les paniers boulangerie sont les moins chers ; les paniers restaurant et épicerie coûtent plus mais contiennent davantage.',
          ar: 'تبدأ الأسعار في تونس من 3 دنانير وتحتوي السلة على ما لا يقل عن ثلاثة أضعاف قيمة ما تدفعه.',
        },
      },
    ],
    nearby: ['bizerte', 'nabeul', 'hammamet'],
  },
  {
    slug: 'sousse',
    name: { en: 'Sousse', fr: 'Sousse', ar: 'سوسة' },
    region: { en: 'Sousse', fr: 'Sousse', ar: 'سوسة' },
    postalCode: '4000',
    coordinates: { lat: 35.8288, lng: 10.6405 },
    serviceRadiusMeters: 15000,
    metaTitle: {
      en: 'Anti-Waste Food in Sousse — Save Surplus Meals Daily',
      fr: 'Anti-Gaspi à Sousse — Sauvez des Repas Chaque Jour',
      ar: 'مكافحة هدر الطعام في سوسة',
    },
    metaDescription: {
      en: 'Reserve discounted surprise bags from bakeries, hotels and restaurants across Sousse, Khezama and Port El Kantaoui. Good food saved, up to 70% off.',
      fr: "Réservez des paniers surprise à prix réduit auprès des boulangeries, hôtels et restaurants de Sousse, Khezama et Port El Kantaoui. Jusqu'à -70%.",
      ar: 'احجز سلال مفاجأة بأسعار مخفضة من المخابز والفنادق والمطاعم في سوسة.',
    },
    heading: {
      en: 'Fight Food Waste in Sousse',
      fr: 'Luttez Contre le Gaspillage Alimentaire à Sousse',
      ar: 'كافح هدر الطعام في سوسة',
    },
    intro: {
      en: 'Sousse combines a year-round resident population with a heavy tourist season, and both produce surplus. Hotels along the corniche, bakeries in the Medina and restaurants in Khezama all finish the day with food that deserves better than a bin.',
      fr: "Sousse combine une population résidente à l'année et une forte saison touristique, et les deux génèrent des invendus. Les hôtels de la corniche, les boulangeries de la Médina et les restaurants de Khezama terminent tous la journée avec des produits qui méritent mieux que la poubelle.",
      ar: 'تجمع سوسة بين سكان دائمين وموسم سياحي كثيف، وكلاهما ينتج فائضًا غذائيًا يوميًا.',
    },
    localContext: {
      en: 'Tourism makes waste in Sousse strongly seasonal. Between June and September, hotel buffets and seafront restaurants generate large volumes of surplus in a short window — which is exactly when surprise bags are most abundant and cheapest.',
      fr: "Le tourisme rend le gaspillage à Sousse fortement saisonnier. Entre juin et septembre, les buffets d'hôtel et les restaurants du front de mer génèrent de gros volumes d'invendus sur une courte période — c'est précisément là que les paniers sont les plus nombreux et les moins chers.",
      ar: 'يجعل القطاع السياحي الهدر في سوسة موسميًا بشكل كبير، خاصة بين يونيو وسبتمبر.',
    },
    neighborhoods: [
      'Medina',
      'Khezama',
      'Port El Kantaoui',
      'Sahloul',
      'Hammam Sousse',
      'Kalaa Kebira',
    ],
    cuisine: {
      en: 'Coastal Sousse leans seafood: grilled fish, seafood couscous and ojja from restaurants near the port, alongside classic bakery output and hotel patisserie.',
      fr: "Sousse la côtière privilégie les produits de la mer : poisson grillé, couscous au poisson et ojja des restaurants près du port, aux côtés de la production classique des boulangeries et de la pâtisserie d'hôtel.",
      ar: 'تميل سوسة الساحلية إلى المأكولات البحرية: السمك المشوي وكسكسي الحوت والعجة.',
    },
    faqs: [
      {
        question: {
          en: 'Are there surprise bags in Port El Kantaoui?',
          fr: 'Y a-t-il des paniers surprise à Port El Kantaoui ?',
          ar: 'هل تتوفر سلال مفاجأة في القنطاوي؟',
        },
        answer: {
          en: 'Yes. Port El Kantaoui has strong availability during the tourist season, mainly from hotels and marina restaurants. Availability drops in winter as venues reduce hours.',
          fr: 'Oui. Port El Kantaoui offre une bonne disponibilité pendant la saison touristique, principalement via les hôtels et les restaurants de la marina. La disponibilité baisse en hiver.',
          ar: 'نعم، خاصة خلال الموسم السياحي من الفنادق ومطاعم المرسى.',
        },
      },
    ],
    nearby: ['monastir', 'hammamet', 'sfax'],
  },
  {
    slug: 'sfax',
    name: { en: 'Sfax', fr: 'Sfax', ar: 'صفاقس' },
    region: { en: 'Sfax', fr: 'Sfax', ar: 'صفاقس' },
    postalCode: '3000',
    coordinates: { lat: 34.7406, lng: 10.7603 },
    serviceRadiusMeters: 15000,
    metaTitle: {
      en: 'Anti-Waste Food in Sfax — Rescue Surplus, Save Money',
      fr: 'Anti-Gaspi à Sfax — Sauvez les Invendus, Économisez',
      ar: 'مكافحة هدر الطعام في صفاقس',
    },
    metaDescription: {
      en: "Tunisia's second city wastes food at industrial scale. Reserve surprise bags from Sfax bakeries, restaurants and grocers at up to 70% off and collect the same day.",
      fr: "La deuxième ville de Tunisie gaspille à l'échelle industrielle. Réservez des paniers surprise auprès des boulangeries, restaurants et épiceries de Sfax jusqu'à -70%.",
      ar: 'احجز سلال مفاجأة من مخابز ومطاعم وبقالات صفاقس بخصم يصل إلى 70%.',
    },
    heading: {
      en: 'Fight Food Waste in Sfax',
      fr: 'Luttez Contre le Gaspillage Alimentaire à Sfax',
      ar: 'كافح هدر الطعام في صفاقس',
    },
    intro: {
      en: "As Tunisia's second-largest city and its industrial and commercial engine, Sfax moves enormous volumes of food every day. A meaningful share never gets sold. Too Fresh To Waste turns that surplus into affordable surprise bags instead of landfill.",
      fr: "Deuxième ville de Tunisie et moteur industriel et commercial du pays, Sfax fait circuler d'énormes volumes de nourriture chaque jour. Une part significative n'est jamais vendue. Too Fresh To Waste transforme ces invendus en paniers surprise abordables plutôt qu'en déchets.",
      ar: 'بوصفها ثاني أكبر مدينة في تونس ومحركها الصناعي والتجاري، تتحرك في صفاقس كميات هائلة من الطعام يوميًا.',
    },
    localContext: {
      en: 'Sfax sits at the centre of Tunisia’s olive oil and seafood trade, and its wholesale markets set the rhythm of the city. Surplus here skews toward fresh produce and prepared food from the dense commercial districts around Bab Bhar and the port.',
      fr: "Sfax est au cœur du commerce tunisien de l'huile d'olive et des produits de la mer, et ses marchés de gros donnent le rythme de la ville. Les invendus penchent ici vers les produits frais et les plats préparés des quartiers commerçants denses autour de Bab Bhar et du port.",
      ar: 'تقع صفاقس في قلب تجارة زيت الزيتون والمأكولات البحرية في تونس.',
    },
    neighborhoods: ['Medina', 'Bab Bhar', 'Sakiet Ezzit', 'Sakiet Eddaier', 'Chihia', 'El Ain'],
    cuisine: {
      en: 'Sfaxian food is distinctive: charmoula, kamounia, marqa and some of the best seafood on the coast, alongside the sesame-rich pastries the city is known for.',
      fr: 'La cuisine sfaxienne est distinctive : charmoula, kamounia, marqa et parmi les meilleurs produits de la mer de la côte, aux côtés des pâtisseries au sésame dont la ville est réputée.',
      ar: 'المطبخ الصفاقسي مميز: الشرمولة والكمونية والمرقة وأجود المأكولات البحرية.',
    },
    faqs: [
      {
        question: {
          en: 'Can restaurants in Sfax join Too Fresh To Waste?',
          fr: 'Les restaurants de Sfax peuvent-ils rejoindre Too Fresh To Waste ?',
          ar: 'هل يمكن لمطاعم صفاقس الانضمام؟',
        },
        answer: {
          en: 'Yes. Any bakery, restaurant, hotel or grocer in Sfax can register as a partner, list surplus as surprise bags and recover revenue on food that would otherwise be discarded.',
          fr: "Oui. Toute boulangerie, restaurant, hôtel ou épicerie de Sfax peut s'inscrire comme partenaire, proposer ses invendus en paniers surprise et récupérer du chiffre d'affaires sur des produits autrement jetés.",
          ar: 'نعم، يمكن لأي مخبز أو مطعم أو فندق أو بقالة التسجيل كشريك.',
        },
      },
    ],
    nearby: ['sousse', 'monastir'],
  },
  {
    slug: 'monastir',
    name: { en: 'Monastir', fr: 'Monastir', ar: 'المنستير' },
    region: { en: 'Monastir', fr: 'Monastir', ar: 'المنستير' },
    postalCode: '5000',
    coordinates: { lat: 35.7643, lng: 10.8113 },
    serviceRadiusMeters: 12000,
    metaTitle: {
      en: 'Anti-Waste Food in Monastir — Surprise Bags Near You',
      fr: 'Anti-Gaspi à Monastir — Paniers Surprise Près de Chez Vous',
      ar: 'مكافحة هدر الطعام في المنستير',
    },
    metaDescription: {
      en: 'Save unsold food from Monastir bakeries, hotels and restaurants. Reserve a surprise bag near the marina, Skanes or the university district at up to 70% off.',
      fr: "Sauvez les invendus des boulangeries, hôtels et restaurants de Monastir. Réservez un panier près de la marina, à Skanès ou dans le quartier universitaire jusqu'à -70%.",
      ar: 'أنقذ الطعام غير المباع من مخابز وفنادق ومطاعم المنستير.',
    },
    heading: {
      en: 'Fight Food Waste in Monastir',
      fr: 'Luttez Contre le Gaspillage Alimentaire à Monastir',
      ar: 'كافح هدر الطعام في المنستير',
    },
    intro: {
      en: 'Monastir pairs a large student population with a busy tourist coastline. Both mean predictable daily surplus — and both mean people who benefit from food at a third of the usual price.',
      fr: 'Monastir associe une importante population étudiante à un littoral touristique animé. Les deux génèrent des invendus quotidiens prévisibles — et les deux comptent des personnes pour qui la nourriture à un tiers du prix compte vraiment.',
      ar: 'تجمع المنستير بين عدد كبير من الطلاب وساحل سياحي نشط.',
    },
    localContext: {
      en: 'The university district creates steady demand for cheap, good food during term time, while Skanes hotels produce the bulk of the summer surplus. That split makes Monastir one of the most consistent cities for year-round availability.',
      fr: "Le quartier universitaire crée une demande constante de nourriture bon marché pendant l'année scolaire, tandis que les hôtels de Skanès produisent l'essentiel des invendus estivaux. Cette répartition fait de Monastir l'une des villes les plus régulières à l'année.",
      ar: 'يخلق الحي الجامعي طلبًا ثابتًا على الطعام الرخيص طوال السنة الدراسية.',
    },
    neighborhoods: ['Marina', 'Skanes', 'Ksar Hellal', 'Sahline', 'Jemmal', 'Khniss'],
    cuisine: {
      en: 'Expect fresh seafood from the marina, traditional Sahel pastries, and student-priced sandwiches and pizza from the university quarter.',
      fr: 'Attendez-vous à des produits de la mer frais de la marina, des pâtisseries traditionnelles du Sahel, et des sandwichs et pizzas à prix étudiant du quartier universitaire.',
      ar: 'توقع مأكولات بحرية طازجة وحلويات ساحلية تقليدية.',
    },
    faqs: [
      {
        question: {
          en: 'Is Too Fresh To Waste good for students in Monastir?',
          fr: 'Too Fresh To Waste est-il adapté aux étudiants de Monastir ?',
          ar: 'هل التطبيق مناسب للطلاب؟',
        },
        answer: {
          en: 'It is one of the cheapest ways to eat well in the city. A surprise bag from a bakery or sandwich shop near campus typically costs less than a single takeaway meal.',
          fr: "C'est l'une des façons les moins chères de bien manger en ville. Un panier d'une boulangerie ou d'un snack près du campus coûte généralement moins qu'un seul repas à emporter.",
          ar: 'نعم، إنها من أرخص الطرق للأكل الجيد في المدينة.',
        },
      },
    ],
    nearby: ['sousse', 'sfax', 'hammamet'],
  },
  {
    slug: 'hammamet',
    name: { en: 'Hammamet', fr: 'Hammamet', ar: 'الحمامات' },
    region: { en: 'Nabeul', fr: 'Nabeul', ar: 'نابل' },
    postalCode: '8050',
    coordinates: { lat: 36.4, lng: 10.6167 },
    serviceRadiusMeters: 12000,
    metaTitle: {
      en: 'Anti-Waste Food in Hammamet — Hotel & Bakery Surplus',
      fr: 'Anti-Gaspi à Hammamet — Invendus Hôtels & Boulangeries',
      ar: 'مكافحة هدر الطعام في الحمامات',
    },
    metaDescription: {
      en: "Hammamet's hotels and restaurants produce Tunisia's most seasonal food surplus. Reserve a surprise bag in Yasmine Hammamet or the old town at up to 70% off.",
      fr: "Les hôtels et restaurants d'Hammamet génèrent les invendus les plus saisonniers de Tunisie. Réservez un panier à Yasmine Hammamet ou en centre-ville jusqu'à -70%.",
      ar: 'تنتج فنادق ومطاعم الحمامات فائضًا موسميًا كبيرًا.',
    },
    heading: {
      en: 'Fight Food Waste in Hammamet',
      fr: 'Luttez Contre le Gaspillage Alimentaire à Hammamet',
      ar: 'كافح هدر الطعام في الحمامات',
    },
    intro: {
      en: 'Hammamet lives on tourism, and tourism produces buffets. Hotel kitchens in Yasmine Hammamet and restaurants around the medina finish every service with quality food that has nowhere to go — until now.',
      fr: "Hammamet vit du tourisme, et le tourisme produit des buffets. Les cuisines d'hôtel de Yasmine Hammamet et les restaurants autour de la médina terminent chaque service avec des produits de qualité qui n'ont nulle part où aller — jusqu'à présent.",
      ar: 'تعيش الحمامات على السياحة، والسياحة تنتج بوفيهات ضخمة.',
    },
    localContext: {
      en: 'Availability in Hammamet swings hard with the season. Peak summer brings the widest choice and the deepest discounts as hotels clear buffets nightly; winter shifts the supply toward year-round bakeries and local restaurants in the old town.',
      fr: "La disponibilité à Hammamet varie fortement avec la saison. Le pic estival offre le plus grand choix et les remises les plus importantes, les hôtels vidant leurs buffets chaque soir ; l'hiver déplace l'offre vers les boulangeries à l'année et les restaurants locaux de la vieille ville.",
      ar: 'تتفاوت الوفرة في الحمامات بشدة حسب الموسم.',
    },
    neighborhoods: ['Yasmine Hammamet', 'Medina', 'Hammamet Sud', 'Nabeul Road', 'Bir Bouregba'],
    cuisine: {
      en: 'Hotel buffet surplus means variety: grilled meats, salads, pastries and international dishes, alongside Cap Bon citrus and local bakery goods.',
      fr: "Les invendus de buffets d'hôtel signifient de la variété : grillades, salades, pâtisseries et plats internationaux, aux côtés des agrumes du Cap Bon et des produits de boulangerie locaux.",
      ar: 'تعني فوائض بوفيه الفنادق تنوعًا كبيرًا في الأطباق.',
    },
    faqs: [
      {
        question: {
          en: 'When is the best time to find bags in Hammamet?',
          fr: 'Quel est le meilleur moment pour trouver des paniers à Hammamet ?',
          ar: 'ما هو أفضل وقت لإيجاد السلال؟',
        },
        answer: {
          en: 'June to September offers the widest choice as hotels clear buffets each evening. Outside the season, bakeries and local restaurants still list daily, typically after 6pm.',
          fr: 'De juin à septembre, le choix est le plus large car les hôtels vident leurs buffets chaque soir. Hors saison, les boulangeries et restaurants locaux publient quand même quotidiennement, généralement après 18h.',
          ar: 'من يونيو إلى سبتمبر يكون الاختيار أوسع ما يكون.',
        },
      },
    ],
    nearby: ['nabeul', 'tunis', 'sousse'],
  },
  {
    slug: 'bizerte',
    name: { en: 'Bizerte', fr: 'Bizerte', ar: 'بنزرت' },
    region: { en: 'Bizerte', fr: 'Bizerte', ar: 'بنزرت' },
    postalCode: '7000',
    coordinates: { lat: 37.2744, lng: 9.8739 },
    serviceRadiusMeters: 12000,
    metaTitle: {
      en: 'Anti-Waste Food in Bizerte — Save Surplus from Local Shops',
      fr: 'Anti-Gaspi à Bizerte — Sauvez les Invendus Locaux',
      ar: 'مكافحة هدر الطعام في بنزرت',
    },
    metaDescription: {
      en: "Northern Tunisia's port city throws away good food every day. Reserve surprise bags from Bizerte bakeries, fishmongers and restaurants at up to 70% off.",
      fr: "La ville portuaire du nord de la Tunisie jette de la bonne nourriture chaque jour. Réservez des paniers auprès des boulangeries, poissonneries et restaurants de Bizerte jusqu'à -70%.",
      ar: 'احجز سلال مفاجأة من مخابز ومطاعم بنزرت بخصم يصل إلى 70%.',
    },
    heading: {
      en: 'Fight Food Waste in Bizerte',
      fr: 'Luttez Contre le Gaspillage Alimentaire à Bizerte',
      ar: 'كافح هدر الطعام في بنزرت',
    },
    intro: {
      en: "Bizerte's old port and fish market run on fresh stock that has to move the same day. What does not sell is still perfectly good — and now it can reach a table instead of a bin.",
      fr: "Le vieux port et le marché aux poissons de Bizerte fonctionnent avec des produits frais qui doivent partir le jour même. Ce qui ne se vend pas reste parfaitement bon — et peut désormais atteindre une table plutôt qu'une poubelle.",
      ar: 'يعمل ميناء بنزرت القديم وسوق السمك بمنتجات طازجة يجب بيعها في نفس اليوم.',
    },
    localContext: {
      en: 'Fresh fish and produce dominate the waste profile in Bizerte, because both are stocked daily and neither keeps. That makes early-evening collection especially valuable here — the discount is steepest right before close.',
      fr: 'Le poisson frais et les produits maraîchers dominent le profil du gaspillage à Bizerte, car les deux sont approvisionnés quotidiennement et aucun ne se conserve. La collecte en début de soirée y est donc particulièrement intéressante — la remise est maximale juste avant la fermeture.',
      ar: 'يهيمن السمك الطازج والخضروات على نمط الهدر في بنزرت.',
    },
    neighborhoods: ['Vieux Port', 'Corniche', 'Zarzouna', 'Menzel Bourguiba', 'Ras Jebel'],
    cuisine: {
      en: 'Bizerte means fish: grilled sardines, seafood couscous and the day’s catch, alongside northern bakery staples and Mateur-region produce.',
      fr: "Bizerte, c'est le poisson : sardines grillées, couscous aux fruits de mer et la pêche du jour, aux côtés des classiques de boulangerie du nord et des produits de la région de Mateur.",
      ar: 'بنزرت تعني السمك: السردين المشوي وكسكسي المأكولات البحرية.',
    },
    faqs: [
      {
        question: {
          en: 'Is seafood safe to buy as a surprise bag?',
          fr: 'Les produits de la mer sont-ils sûrs en panier surprise ?',
          ar: 'هل المأكولات البحرية آمنة في سلة المفاجأة؟',
        },
        answer: {
          en: 'Yes. Partners may only list food that is still within its safe consumption window and stored correctly. Seafood bags are collected the same day they are caught and listed.',
          fr: 'Oui. Les partenaires ne peuvent proposer que des produits encore dans leur fenêtre de consommation sûre et correctement conservés. Les paniers de produits de la mer sont récupérés le jour même.',
          ar: 'نعم، لا يجوز للشركاء عرض إلا الطعام الصالح للاستهلاك والمحفوظ بشكل صحيح.',
        },
      },
    ],
    nearby: ['tunis', 'nabeul'],
  },
  {
    slug: 'nabeul',
    name: { en: 'Nabeul', fr: 'Nabeul', ar: 'نابل' },
    region: { en: 'Nabeul', fr: 'Nabeul', ar: 'نابل' },
    postalCode: '8000',
    coordinates: { lat: 36.4561, lng: 10.7376 },
    serviceRadiusMeters: 12000,
    metaTitle: {
      en: 'Anti-Waste Food in Nabeul — Cap Bon Surplus Rescued',
      fr: 'Anti-Gaspi à Nabeul — Les Invendus du Cap Bon Sauvés',
      ar: 'مكافحة هدر الطعام في نابل',
    },
    metaDescription: {
      en: "Nabeul sits in Tunisia's richest agricultural region, and produce surplus is a daily fact. Reserve surprise bags from local grocers, bakeries and restaurants at up to 70% off.",
      fr: "Nabeul est au cœur du Cap Bon, la région agricole la plus riche de Tunisie. Réservez des paniers surprise auprès des épiceries et boulangeries locales jusqu'à -70%.",
      ar: 'تقع نابل في أغنى منطقة زراعية في تونس، والفائض يومي.',
    },
    heading: {
      en: 'Fight Food Waste in Nabeul',
      fr: 'Luttez Contre le Gaspillage Alimentaire à Nabeul',
      ar: 'كافح هدر الطعام في نابل',
    },
    intro: {
      en: 'Nabeul is the heart of Cap Bon, where Tunisia grows its citrus, tomatoes and peppers. Abundance has a cost: produce that never reaches a buyer. Too Fresh To Waste redirects it to people who want it.',
      fr: "Nabeul est le cœur du Cap Bon, où la Tunisie cultive ses agrumes, tomates et piments. L'abondance a un coût : des produits qui ne trouvent jamais d'acheteur. Too Fresh To Waste les redirige vers ceux qui en veulent.",
      ar: 'نابل هي قلب الوطن القبلي، حيث تزرع تونس الحمضيات والطماطم والفلفل.',
    },
    localContext: {
      en: 'Agricultural surplus behaves differently from restaurant surplus: it arrives in volume, seasonally, and it is mostly raw ingredients rather than prepared meals. Nabeul bags therefore skew toward fruit, vegetables and preserves — excellent value if you cook.',
      fr: 'Les invendus agricoles se comportent différemment des invendus de restaurant : ils arrivent en volume, de manière saisonnière, et ce sont surtout des ingrédients bruts plutôt que des plats préparés. Les paniers de Nabeul penchent donc vers les fruits, légumes et conserves — excellent rapport qualité-prix si vous cuisinez.',
      ar: 'يختلف الفائض الزراعي عن فائض المطاعم: يأتي بكميات كبيرة وموسمية.',
    },
    neighborhoods: [
      'Centre Ville',
      'Dar Chaabane',
      'Beni Khiar',
      'Korba',
      'Kelibia',
      'Menzel Temime',
    ],
    cuisine: {
      en: 'Cap Bon produce dominates: citrus, tomatoes, peppers and harissa, plus the ceramics-quarter bakeries and grilled-fish restaurants along the coast.',
      fr: 'Les produits du Cap Bon dominent : agrumes, tomates, piments et harissa, ainsi que les boulangeries du quartier des céramistes et les restaurants de poisson grillé le long de la côte.',
      ar: 'تهيمن منتجات الوطن القبلي: الحمضيات والطماطم والفلفل والهريسة.',
    },
    faqs: [
      {
        question: {
          en: 'What is usually inside a Nabeul surprise bag?',
          fr: 'Que contient généralement un panier surprise à Nabeul ?',
          ar: 'ماذا تحتوي سلة المفاجأة في نابل عادة؟',
        },
        answer: {
          en: 'More raw produce than in other cities — seasonal fruit and vegetables from Cap Bon farms and grocers, plus bakery items. Contents vary by partner and by season.',
          fr: "Davantage de produits bruts que dans d'autres villes — fruits et légumes de saison des fermes et épiceries du Cap Bon, plus des produits de boulangerie. Le contenu varie selon le partenaire et la saison.",
          ar: 'منتجات طازجة أكثر من المدن الأخرى — فواكه وخضروات موسمية.',
        },
      },
    ],
    nearby: ['hammamet', 'tunis', 'bizerte'],
  },
] as const;

/** Slugs only — the single source of truth the sitemap and route both read. */
export const citySlugs: readonly string[] = cities.map(c => c.slug);

export function getCityBySlug(slug: string): CityContent | undefined {
  return cities.find(c => c.slug === slug);
}

/**
 * Every locale × city pair the /locations/[city] route prerenders.
 *
 * Kept here rather than inline in the route so it can be asserted directly in
 * tests — importing the page module pulls next-intl's ESM build through Jest,
 * which the transform does not handle.
 */
export function getCityStaticParams<L extends string>(
  localeList: readonly L[],
): Array<{ locale: L; city: string }> {
  return localeList.flatMap(locale => cities.map(city => ({ locale, city: city.slug })));
}

/** Narrow a LocalizedText to the active locale, falling back to English. */
export function t(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en;
}

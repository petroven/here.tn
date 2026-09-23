/**
 * Les 24 gouvernorats (valeur = identifiant envoyé à l'API, identique au backend),
 * avec le nom arabe et quelques villes principales pour faciliter la saisie.
 */
export const GOVERNORATES: { value: string; ar: string; cities: string[] }[] = [
  { value: 'Ariana', ar: 'أريانة', cities: ['Ariana Ville', 'La Soukra', 'Raoued', 'Ettadhamen', 'Mnihla'] },
  { value: 'Béja', ar: 'باجة', cities: ['Béja', 'Medjez el-Bab', 'Testour', 'Nefza'] },
  { value: 'Ben Arous', ar: 'بن عروس', cities: ['Ben Arous', 'Ezzahra', 'Hammam Lif', 'Mégrine', 'Radès', 'El Mourouj'] },
  { value: 'Bizerte', ar: 'بنزرت', cities: ['Bizerte', 'Menzel Bourguiba', 'Mateur', 'Ras Jebel'] },
  { value: 'Gabès', ar: 'قابس', cities: ['Gabès', 'Mareth', 'El Hamma', 'Métouia'] },
  { value: 'Gafsa', ar: 'قفصة', cities: ['Gafsa', 'Métlaoui', 'Redeyef', 'El Ksar'] },
  { value: 'Jendouba', ar: 'جندوبة', cities: ['Jendouba', 'Tabarka', 'Aïn Draham', 'Bou Salem'] },
  { value: 'Kairouan', ar: 'القيروان', cities: ['Kairouan', 'Haffouz', 'Sbikha', 'Oueslatia'] },
  { value: 'Kasserine', ar: 'القصرين', cities: ['Kasserine', 'Sbeïtla', 'Fériana', 'Thala'] },
  { value: 'Kébili', ar: 'قبلي', cities: ['Kébili', 'Douz', 'Souk Lahad'] },
  { value: 'Le Kef', ar: 'الكاف', cities: ['Le Kef', 'Dahmani', 'Tajerouine', 'Sakiet Sidi Youssef'] },
  { value: 'Mahdia', ar: 'المهدية', cities: ['Mahdia', 'Ksour Essef', 'El Jem', 'Chebba'] },
  { value: 'La Manouba', ar: 'منوبة', cities: ['Manouba', 'Den Den', 'Douar Hicher', 'Oued Ellil', 'Tebourba'] },
  { value: 'Médenine', ar: 'مدنين', cities: ['Médenine', 'Djerba Houmt Souk', 'Zarzis', 'Ben Gardane', 'Midoun'] },
  { value: 'Monastir', ar: 'المنستير', cities: ['Monastir', 'Moknine', 'Ksar Hellal', 'Jemmal', 'Sahline'] },
  { value: 'Nabeul', ar: 'نابل', cities: ['Nabeul', 'Hammamet', 'Kélibia', 'Korba', 'Menzel Temime', 'Grombalia'] },
  { value: 'Sfax', ar: 'صفاقس', cities: ['Sfax Ville', 'Sakiet Ezzit', 'Sakiet Eddaïer', 'Thyna', 'El Ain', 'Mahrès'] },
  { value: 'Sidi Bouzid', ar: 'سيدي بوزيد', cities: ['Sidi Bouzid', 'Regueb', 'Meknassy', 'Jilma'] },
  { value: 'Siliana', ar: 'سليانة', cities: ['Siliana', 'Makthar', 'Bou Arada', 'Gaâfour'] },
  { value: 'Sousse', ar: 'سوسة', cities: ['Sousse', 'Hammam Sousse', 'Msaken', 'Akouda', 'Kalâa Kebira', 'Enfida'] },
  { value: 'Tataouine', ar: 'تطاوين', cities: ['Tataouine', 'Ghomrassen', 'Remada'] },
  { value: 'Tozeur', ar: 'توزر', cities: ['Tozeur', 'Nefta', 'Degache'] },
  { value: 'Tunis', ar: 'تونس', cities: ['Tunis', 'La Marsa', 'Carthage', 'Le Bardo', 'La Goulette', 'El Menzah', 'Lac 1', 'Lac 2'] },
  { value: 'Zaghouan', ar: 'زغوان', cities: ['Zaghouan', 'El Fahs', 'Nadhour'] },
];

export const governorateLabel = (value: string, lang: 'fr' | 'ar') =>
  lang === 'ar' ? (GOVERNORATES.find((g) => g.value === value)?.ar ?? value) : value;

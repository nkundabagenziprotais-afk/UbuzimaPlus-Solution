export type RuntimeLanguage = 'en' | 'fr' | 'pt';

const textOriginals = new WeakMap<Text, string>();

const dictionaries: Record<Exclude<RuntimeLanguage, 'en'>, Record<string, string>> = {
  fr: {
    'About us': 'A propos',
    Solutions: 'Solutions',
    Trust: 'Confiance',
    Overview: 'Apercu',
    Mission: 'Mission',
    Vision: 'Vision',
    'Our Team': 'Notre equipe',
    'Solution Portfolio': 'Portefeuille de solutions',
    PharmaCo360: 'PharmaCo360',
    'Who We Serve': 'Nos publics',
    Security: 'Securite',
    Contact: 'Contact',
    Services: 'Services',
    'Pharmacy Care': 'Soins pharmacie',
    Wellness: 'Bien-etre',
    'Request Demo': 'Demander une demo',
    'Staff Login': 'Connexion equipe',
    Language: 'Langue',
    Medicines: 'Medicaments',
    'Family health': 'Sante familiale',
    Support: 'Assistance',
    'Explore services': 'Voir les services',
    'Digital health business platform': 'Plateforme numerique de sante',
  },
  pt: {
    'About us': 'Sobre nos',
    Solutions: 'Solucoes',
    Trust: 'Confianca',
    Overview: 'Visao geral',
    Mission: 'Missao',
    Vision: 'Visao',
    'Our Team': 'Nossa equipa',
    'Solution Portfolio': 'Portfolio de solucoes',
    PharmaCo360: 'PharmaCo360',
    'Who We Serve': 'Quem servimos',
    Security: 'Seguranca',
    Contact: 'Contacto',
    Services: 'Servicos',
    'Pharmacy Care': 'Cuidados farmacia',
    Wellness: 'Bem-estar',
    'Request Demo': 'Solicitar demo',
    'Staff Login': 'Entrar equipa',
    Language: 'Idioma',
    Medicines: 'Medicamentos',
    'Family health': 'Saude familiar',
    Support: 'Apoio',
    'Explore services': 'Ver servicos',
    'Digital health business platform': 'Plataforma digital de saude',
  },
};

function translate(value: string, language: RuntimeLanguage): string {
  if (language === 'en') return value;

  return dictionaries[language][value.trim()] ?? value;
}

export function applyRuntimeLanguage(language: RuntimeLanguage, root: ParentNode = document): void {
  document.documentElement.lang = language;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'CODE'].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let current = walker.nextNode() as Text | null;
  while (current) {
    const original = textOriginals.get(current) ?? current.nodeValue ?? '';
    textOriginals.set(current, original);
    const leading = original.match(/^\s*/)?.[0] ?? '';
    const trailing = original.match(/\s*$/)?.[0] ?? '';
    current.nodeValue = `${leading}${translate(original.trim(), language)}${trailing}`;
    current = walker.nextNode() as Text | null;
  }
}

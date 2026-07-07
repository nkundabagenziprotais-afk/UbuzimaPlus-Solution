export type RuntimeLanguage = 'en' | 'fr' | 'pt';

const textOriginals = new WeakMap<Text, string>();
const placeholderOriginals = new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>();

const dictionaries: Record<Exclude<RuntimeLanguage, 'en'>, Record<string, string>> = {
  fr: {
    Dashboard: 'Tableau de bord',
    Inventory: 'Inventaire',
    'POS and Sales': 'Caisse et ventes',
    Suppliers: 'Fournisseurs',
    Finance: 'Finance',
    Reports: 'Rapports',
    'Pharmacist Chat': 'Chat pharmacien',
    'AI Recommendations': 'Recommandations IA',
    'AI Center': 'Centre IA',
    'Overview Summary': 'Resume general',
    'Low Stock Watch List': 'Liste stock faible',
    'Retail Product Shelf': 'Rayon produits detail',
    'Batch and Expiry Preview': 'Lots et expirations',
    'Near Expiry Watch List': 'Liste expiration proche',
    'Product Master': 'Referentiel produits',
    'Stock Locations': 'Emplacements stock',
    'Transaction summary': 'Resume transaction',
    'Customer contribution': 'Contribution client',
    'Insurance / partner contribution': 'Contribution assurance / partenaire',
    'Customer wants invoice': 'Le client veut une facture',
    'Business Setup': 'Configuration entreprise',
    'Users and Security': 'Utilisateurs et securite',
    'Staff 2FA': '2FA du personnel',
    'Corporate Email': 'Email professionnel',
    Notifications: 'Notifications',
    'Language and Market': 'Langue et marche',
    'Nearby Providers': 'Prestataires proches',
    'Sign out': 'Deconnexion',
    Back: 'Retour',
    Website: 'Site web',
    'Email Corporate': 'Email professionnel',
    Continue: 'Continuer',
    'Email address': 'Adresse email',
    Password: 'Mot de passe',
    'Phone number': 'Numero de telephone',
    '4-digit PIN': 'PIN a 4 chiffres',
    'Phone PIN': 'PIN telephone',
    'Back to website': 'Retour au site web',
    'Access your workspace': 'Acceder a votre espace de travail',
    'Tenant admin dashboard': 'Tableau de bord tenant',
    'Start POS sale': 'Demarrer une vente POS',
    'Review stock': 'Verifier le stock',
    'Receive supplier stock': 'Reception fournisseur',
    'Open daily reports': 'Ouvrir les rapports',
    'Manage users': 'Gerer les utilisateurs',
    'Customer messages': 'Messages clients',
    'Retail product shelf': 'Rayon produits',
    'Product browser': 'Recherche produits',
    'Sale cart': 'Panier de vente',
    'Create customer': 'Creer client',
    'Create prescription': 'Creer ordonnance',
    'Create draft sale': 'Creer vente brouillon',
    'Refresh POS data': 'Actualiser les donnees POS',
    'Refresh inventory': 'Actualiser inventaire',
    'Open POS': 'Ouvrir POS',
    'Manage products': 'Gerer produits',
  },
  pt: {
    Dashboard: 'Painel',
    Inventory: 'Inventario',
    'POS and Sales': 'POS e vendas',
    Suppliers: 'Fornecedores',
    Finance: 'Financas',
    Reports: 'Relatorios',
    'Pharmacist Chat': 'Chat farmaceutico',
    'AI Recommendations': 'Recomendacoes de IA',
    'AI Center': 'Centro de IA',
    'Overview Summary': 'Resumo geral',
    'Low Stock Watch List': 'Lista stock baixo',
    'Retail Product Shelf': 'Prateleira de produtos',
    'Batch and Expiry Preview': 'Lotes e validade',
    'Near Expiry Watch List': 'Lista validade proxima',
    'Product Master': 'Cadastro de produtos',
    'Stock Locations': 'Locais de stock',
    'Transaction summary': 'Resumo da transacao',
    'Customer contribution': 'Contribuicao do cliente',
    'Insurance / partner contribution': 'Contribuicao seguro / parceiro',
    'Customer wants invoice': 'Cliente quer fatura',
    'Business Setup': 'Configuracao da empresa',
    'Users and Security': 'Usuarios e seguranca',
    'Staff 2FA': '2FA da equipa',
    'Corporate Email': 'Email corporativo',
    Notifications: 'Notificacoes',
    'Language and Market': 'Idioma e mercado',
    'Nearby Providers': 'Prestadores proximos',
    'Sign out': 'Sair',
    Back: 'Voltar',
    Website: 'Site',
    'Email Corporate': 'Email corporativo',
    Continue: 'Continuar',
    'Email address': 'Endereco de email',
    Password: 'Senha',
    'Phone number': 'Numero de telefone',
    '4-digit PIN': 'PIN de 4 digitos',
    'Phone PIN': 'PIN telefone',
    'Back to website': 'Voltar ao site',
    'Access your workspace': 'Aceder ao espaco de trabalho',
    'Tenant admin dashboard': 'Painel do tenant',
    'Start POS sale': 'Iniciar venda POS',
    'Review stock': 'Verificar stock',
    'Receive supplier stock': 'Receber stock',
    'Open daily reports': 'Abrir relatorios',
    'Manage users': 'Gerir usuarios',
    'Customer messages': 'Mensagens de clientes',
    'Retail product shelf': 'Prateleira de produtos',
    'Product browser': 'Pesquisa de produtos',
    'Sale cart': 'Carrinho de venda',
    'Create customer': 'Criar cliente',
    'Create prescription': 'Criar receita',
    'Create draft sale': 'Criar venda rascunho',
    'Refresh POS data': 'Atualizar dados POS',
    'Refresh inventory': 'Atualizar inventario',
    'Open POS': 'Abrir POS',
    'Manage products': 'Gerir produtos',
  },
};

function translateText(value: string, language: RuntimeLanguage): string {
  if (language === 'en') return value;

  return dictionaries[language][value.trim()] ?? value;
}

export function applyRuntimeLanguage(language: RuntimeLanguage, root: ParentNode = document): void {
  document.documentElement.lang = language;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'CODE', 'TEXTAREA'].includes(parent.tagName)) {
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
    const translated = translateText(original.trim(), language);
    current.nodeValue = `${leading}${translated}${trailing}`;
    current = walker.nextNode() as Text | null;
  }

  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[placeholder], textarea[placeholder]').forEach((input) => {
    const original = placeholderOriginals.get(input) ?? input.placeholder;
    placeholderOriginals.set(input, original);
    input.placeholder = translateText(original, language);
  });
}

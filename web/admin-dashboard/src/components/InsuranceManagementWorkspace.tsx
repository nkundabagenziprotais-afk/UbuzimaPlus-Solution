import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  InsuranceContributionRule,
  InsuranceInstitution,
  InsurancePagination,
  InsurancePartner,
  InsurancePartnerDocument,
  InsurancePriceList,
  InsuranceProductPrice,
  InsuranceScheme,
  InsuranceSalesRegisterEntry,
  bootstrapInsuranceDefaults,
  createInsuranceContributionRule,
  createInsuranceInstitution,
  createInsurancePartner,
  updateInsurancePartner,
  getInsurancePartnerDocuments,
  uploadInsurancePartnerDocument,
  createInsurancePriceList,
  createInsuranceProductPrice,
  createInsuranceScheme,
  getInsuranceContributionRules,
  getInsuranceInstitutions,
  getInsurancePartners,
  getInsurancePriceLists,
  getInsuranceProductPrices,
  getInsuranceSchemes,
  getInsuranceSalesRegister,
} from '../lib/insuranceApi';
import { InsuranceClaimsReconciliationWorkspace } from './InsuranceClaimsReconciliationWorkspace';

export type InsuranceWorkspaceKey =
  | 'overview'
  | 'partners'
  | 'institutions'
  | 'schemes'
  | 'price-lists'
  | 'product-prices'
  | 'contribution-rules'
  | 'claims-readiness'
  | 'reconciliation-readiness'
  | 'sales-register'
  | 'audit-readiness';

type Props = {
  token: string;
  tenantSlug: string;
  activeWorkspace: InsuranceWorkspaceKey;
  onWorkspaceChange: (workspace: InsuranceWorkspaceKey) => void;
};

type RegisterState<T> = {
  rows: T[];
  pagination: InsurancePagination | null;
};

const emptyRegister = <T,>(): RegisterState<T> => ({
  rows: [],
  pagination: null,
});

const statusOptions = ['', 'active', 'inactive'];

function money(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat('en-RW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function contribution(
  customer: number | string | null | undefined,
  insurer: number | string | null | undefined,
): string {
  return `${money(customer)}% / ${money(insurer)}%`;
}

function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: InsurancePagination | null;
  onPageChange: (page: number) => void;
}) {
  if (!pagination) {
    return null;
  }

  return (
    <div className="insurance-pagination">
      <span>
        Showing {pagination.from ?? 0}–{pagination.to ?? 0} of{' '}
        {pagination.total}
      </span>

      <div>
        <button
          type="button"
          disabled={pagination.current_page <= 1}
          onClick={() => onPageChange(pagination.current_page - 1)}
        >
          Previous
        </button>

        <strong>
          Page {pagination.current_page} of {pagination.last_page}
        </strong>

        <button
          type="button"
          disabled={pagination.current_page >= pagination.last_page}
          onClick={() => onPageChange(pagination.current_page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const normalized = status || 'unknown';

  return (
    <span className={`insurance-status-pill ${normalized}`}>
      {normalized}
    </span>
  );
}

export function InsuranceManagementWorkspace({
  token,
  tenantSlug,
  activeWorkspace,
  onWorkspaceChange,
}: Props) {
  const [partners, setPartners] =
    useState<RegisterState<InsurancePartner>>(emptyRegister);
  const [institutions, setInstitutions] =
    useState<RegisterState<InsuranceInstitution>>(emptyRegister);
  const [schemes, setSchemes] =
    useState<RegisterState<InsuranceScheme>>(emptyRegister);
  const [priceLists, setPriceLists] =
    useState<RegisterState<InsurancePriceList>>(emptyRegister);
  const [productPrices, setProductPrices] =
    useState<RegisterState<InsuranceProductPrice>>(emptyRegister);
  const [contributionRules, setContributionRules] =
    useState<RegisterState<InsuranceContributionRule>>(emptyRegister);
  const [salesRegister, setSalesRegister] =
    useState<RegisterState<InsuranceSalesRegisterEntry>>(emptyRegister);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [salesRegisterFilters, setSalesRegisterFilters] = useState({
    insurance_partner_id: '',
    insurance_institution_id: '',
    insurance_scheme_id: '',
    claim_status: '',
    from: '',
    to: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [partnerForm, setPartnerForm] = useState({
    code: '',
    name: '',
    partner_type: 'public',
    pricing_mode: 'standard',
    contract_start_date: '',
    contract_expiry_date: '',
    coverage_limit: '',
    external_portal_reference: '',
    requires_price_approval: false,
    contact_name: '',
    phone: '',
    alternative_phone: '',
    email: '',
    customer_contribution_percent: '15',
    insurer_contribution_percent: '85',
    status: 'active',
  });

  const [editingPartnerId, setEditingPartnerId] =
    useState<number | null>(null);
  const [selectedDocumentPartner, setSelectedDocumentPartner] =
    useState<InsurancePartner | null>(null);
  const [partnerDocuments, setPartnerDocuments] = useState<
    InsurancePartnerDocument[]
  >([]);
  const [isLoadingPartnerDocuments, setIsLoadingPartnerDocuments] =
    useState(false);
  const [partnerDocumentForm, setPartnerDocumentForm] = useState({
    document_type: 'contract',
    title: '',
    version: '',
    effective_from: '',
    effective_to: '',
    status: 'active',
    is_primary: false,
    notes: '',
  });
  const [partnerDocumentFile, setPartnerDocumentFile] =
    useState<File | null>(null);

  const [institutionForm, setInstitutionForm] = useState({
    insurance_partner_id: '',
    code: '',
    name: '',
    institution_type: 'employer',
    contact_name: '',
    phone: '',
    alternative_phone: '',
    email: '',
    status: 'active',
  });

  const [schemeForm, setSchemeForm] = useState({
    insurance_partner_id: '',
    insurance_institution_id: '',
    code: '',
    name: '',
    customer_contribution_percent: '15',
    insurer_contribution_percent: '85',
    effective_from: '',
    effective_to: '',
    requires_preauthorization: false,
    status: 'active',
  });

  const [priceListForm, setPriceListForm] = useState({
    insurance_partner_id: '',
    insurance_scheme_id: '',
    code: '',
    name: '',
    currency: 'RWF',
    priority: '100',
    effective_from: '',
    effective_to: '',
    source_type: 'manual',
    source_document_path: '',
    approval_status: 'pending',
    approval_notes: '',
    status: 'active',
  });

  const [productPriceForm, setProductPriceForm] = useState({
    insurance_price_list_id: '',
    product_id: '',
    covered_unit_price: '',
    standard_selling_price_snapshot: '',
    pricing_source: 'contract_price_list',
    price_confidence: '',
    approval_status: 'pending',
    approval_notes: '',
    customer_contribution_percent: '',
    insurer_contribution_percent: '',
    requires_preauthorization: false,
    status: 'active',
  });

  const [ruleForm, setRuleForm] = useState({
    insurance_partner_id: '',
    insurance_institution_id: '',
    insurance_scheme_id: '',
    product_id: '',
    customer_contribution_percent: '15',
    insurer_contribution_percent: '85',
    fixed_customer_amount: '',
    maximum_insurer_amount: '',
    effective_from: '',
    effective_to: '',
    status: 'active',
  });

  const listOptions = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      page,
      perPage,
    }),
    [page, perPage, search, status],
  );

  const loadPartners = useCallback(async () => {
    const response = await getInsurancePartners(
      token,
      tenantSlug,
      listOptions,
    );

    setPartners({
      rows: response.data,
      pagination: response.pagination ?? null,
    });
  }, [listOptions, tenantSlug, token]);

  const loadInstitutions = useCallback(async () => {
    const response = await getInsuranceInstitutions(
      token,
      tenantSlug,
      listOptions,
    );

    setInstitutions({
      rows: response.data,
      pagination: response.pagination ?? null,
    });
  }, [listOptions, tenantSlug, token]);

  const loadSchemes = useCallback(async () => {
    const response = await getInsuranceSchemes(
      token,
      tenantSlug,
      listOptions,
    );

    setSchemes({
      rows: response.data,
      pagination: response.pagination ?? null,
    });
  }, [listOptions, tenantSlug, token]);

  const loadPriceLists = useCallback(async () => {
    const response = await getInsurancePriceLists(
      token,
      tenantSlug,
      listOptions,
    );

    setPriceLists({
      rows: response.data,
      pagination: response.pagination ?? null,
    });
  }, [listOptions, tenantSlug, token]);

  const loadProductPrices = useCallback(async () => {
    const response = await getInsuranceProductPrices(
      token,
      tenantSlug,
      listOptions,
    );

    setProductPrices({
      rows: response.data,
      pagination: response.pagination ?? null,
    });
  }, [listOptions, tenantSlug, token]);

  const loadContributionRules = useCallback(async () => {
    const response = await getInsuranceContributionRules(
      token,
      tenantSlug,
      listOptions,
    );

    setContributionRules({
      rows: response.data,
      pagination: response.pagination ?? null,
    });
  }, [listOptions, tenantSlug, token]);

  const refreshCurrentWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      if (activeWorkspace === 'overview') {
        await Promise.all([
          loadPartners(),
          loadInstitutions(),
          loadSchemes(),
          loadPriceLists(),
          loadProductPrices(),
          loadContributionRules(),
        ]);
      } else if (activeWorkspace === 'partners') {
        await loadPartners();
      } else if (activeWorkspace === 'institutions') {
        await loadInstitutions();
      } else if (activeWorkspace === 'schemes') {
        await loadSchemes();
      } else if (activeWorkspace === 'price-lists') {
        await loadPriceLists();
      } else if (activeWorkspace === 'product-prices') {
        await loadProductPrices();
      } else if (activeWorkspace === 'contribution-rules') {
        await loadContributionRules();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load insurance management data.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    activeWorkspace,
    loadContributionRules,
    loadInstitutions,
    loadPartners,
    loadPriceLists,
    loadProductPrices,
    loadSchemes,
  ]);

  useEffect(() => {
    void refreshCurrentWorkspace();
  }, [refreshCurrentWorkspace]);

  useEffect(() => {
    setPage(1);
  }, [activeWorkspace, search, status, perPage]);

  useEffect(() => {
    if (activeWorkspace === 'sales-register') {
      void loadSalesRegister();
    }
  }, [
    activeWorkspace,
    page,
    perPage,
    salesRegisterFilters.insurance_partner_id,
    salesRegisterFilters.insurance_institution_id,
    salesRegisterFilters.insurance_scheme_id,
    salesRegisterFilters.claim_status,
    salesRegisterFilters.from,
    salesRegisterFilters.to,
    tenantSlug,
    token,
  ]);

  async function handleBootstrap() {
    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      const response = await bootstrapInsuranceDefaults(
        token,
        tenantSlug,
      );

      setNotice(
        response.message ||
          'Insurance partner defaults were initialized successfully.',
      );

      await refreshCurrentWorkspace();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to initialize insurance defaults.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function resetPartnerForm(): void {
    setEditingPartnerId(null);
    setPartnerForm({
      code: '',
      name: '',
      partner_type: 'public',
      pricing_mode: 'standard',
      contract_start_date: '',
      contract_expiry_date: '',
      coverage_limit: '',
      external_portal_reference: '',
      requires_price_approval: false,
      contact_name: '',
      phone: '',
      alternative_phone: '',
      email: '',
      customer_contribution_percent: '15',
      insurer_contribution_percent: '85',
      status: 'active',
    });
    setSelectedDocumentPartner(null);
    setPartnerDocuments([]);
    resetPartnerDocumentForm();
  }

  function loadPartnerForEdit(partner: InsurancePartner): void {
    setEditingPartnerId(partner.id);
    setPartnerForm({
      code: partner.code || '',
      name: partner.name || '',
      partner_type: partner.partner_type || 'public',
      pricing_mode: partner.pricing_mode || 'standard',
      contract_start_date: partner.contract_start_date || '',
      contract_expiry_date: partner.contract_expiry_date || '',
      coverage_limit:
        partner.coverage_limit !== null && partner.coverage_limit !== undefined
          ? String(partner.coverage_limit)
          : '',
      external_portal_reference:
        partner.external_portal_reference || '',
      requires_price_approval:
        Boolean(partner.requires_price_approval),
      contact_name: partner.contact_name || '',
      phone: partner.contact_phone || partner.phone || '',
      alternative_phone: partner.alternative_phone || '',
      email: partner.contact_email || partner.email || '',
      customer_contribution_percent:
        partner.default_customer_contribution_percent !== null &&
        partner.default_customer_contribution_percent !== undefined
          ? String(partner.default_customer_contribution_percent)
          : '15',
      insurer_contribution_percent:
        partner.default_insurer_contribution_percent !== null &&
        partner.default_insurer_contribution_percent !== undefined
          ? String(partner.default_insurer_contribution_percent)
          : '85',
      status: partner.status || 'active',
    });

    setSelectedDocumentPartner(partner);
    setPartnerDocuments([]);
    void loadPartnerDocuments(partner);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function replicatePartner(partner: InsurancePartner): void {
    const baseCode = `${partner.code || 'PARTNER'}-COPY`
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '-')
      .slice(0, 60);

    setEditingPartnerId(null);
    setPartnerForm({
      code: baseCode,
      name: `${partner.name || 'Insurance Partner'} Copy`,
      partner_type: partner.partner_type || 'public',
      pricing_mode: partner.pricing_mode || 'standard',
      contract_start_date: partner.contract_start_date || '',
      contract_expiry_date: partner.contract_expiry_date || '',
      coverage_limit:
        partner.coverage_limit !== null && partner.coverage_limit !== undefined
          ? String(partner.coverage_limit)
          : '',
      external_portal_reference:
        partner.external_portal_reference || '',
      requires_price_approval:
        Boolean(partner.requires_price_approval),
      contact_name: partner.contact_name || '',
      phone: partner.contact_phone || partner.phone || '',
      alternative_phone: partner.alternative_phone || '',
      email: partner.contact_email || partner.email || '',
      customer_contribution_percent:
        partner.default_customer_contribution_percent !== null &&
        partner.default_customer_contribution_percent !== undefined
          ? String(partner.default_customer_contribution_percent)
          : '15',
      insurer_contribution_percent:
        partner.default_insurer_contribution_percent !== null &&
        partner.default_insurer_contribution_percent !== undefined
          ? String(partner.default_insurer_contribution_percent)
          : '85',
      status: 'active',
    });

    setNotice('Partner details copied. Review code/name, then save as a new partner.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function changePartnerStatus(
    partner: InsurancePartner,
    nextStatus: string,
  ): Promise<void> {
    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      await updateInsurancePartner(token, tenantSlug, partner.id, {
        status: nextStatus,
      });

      setNotice(
        nextStatus === 'active'
          ? 'Insurance partner reactivated successfully.'
          : 'Insurance partner suspended successfully.',
      );

      await loadPartners();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update insurance partner status.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function loadSalesRegister(): Promise<void> {
    setIsLoading(true);
    setError('');

    try {
      const response = await getInsuranceSalesRegister(
        token,
        tenantSlug,
        {
          perPage,
          page,
          insurance_partner_id: salesRegisterFilters.insurance_partner_id
            ? Number(salesRegisterFilters.insurance_partner_id)
            : undefined,
          insurance_institution_id:
            salesRegisterFilters.insurance_institution_id
              ? Number(salesRegisterFilters.insurance_institution_id)
              : undefined,
          insurance_scheme_id: salesRegisterFilters.insurance_scheme_id
            ? Number(salesRegisterFilters.insurance_scheme_id)
            : undefined,
          claim_status: salesRegisterFilters.claim_status || undefined,
          from: salesRegisterFilters.from || undefined,
          to: salesRegisterFilters.to || undefined,
        },
      );

      setSalesRegister({
        rows: response.data,
        pagination: response.pagination ?? null,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load insurance sales register.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPartnerDocuments(
    partner: InsurancePartner,
  ): Promise<void> {
    setSelectedDocumentPartner(partner);
    setIsLoadingPartnerDocuments(true);
    setError('');

    try {
      const response = await getInsurancePartnerDocuments(
        token,
        tenantSlug,
        partner.id,
      );

      setPartnerDocuments(response.documents);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load insurance partner documents.',
      );
    } finally {
      setIsLoadingPartnerDocuments(false);
    }
  }

  function resetPartnerDocumentForm(): void {
    setPartnerDocumentForm({
      document_type: 'contract',
      title: '',
      version: '',
      effective_from: '',
      effective_to: '',
      status: 'active',
      is_primary: false,
      notes: '',
    });
    setPartnerDocumentFile(null);
  }

  async function submitPartnerDocument(
    event?: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event?.preventDefault();

    if (!selectedDocumentPartner) {
      setError('Select a partner before uploading a document.');
      return;
    }

    if (!partnerDocumentFile) {
      setError('Choose a document file to upload.');
      return;
    }

    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      const formData = new FormData();
      formData.append(
        'document_type',
        partnerDocumentForm.document_type,
      );
      formData.append('title', partnerDocumentForm.title.trim());
      formData.append('status', partnerDocumentForm.status);
      formData.append(
        'is_primary',
        partnerDocumentForm.is_primary ? '1' : '0',
      );
      formData.append('file', partnerDocumentFile);

      if (partnerDocumentForm.version.trim()) {
        formData.append('version', partnerDocumentForm.version.trim());
      }

      if (partnerDocumentForm.effective_from) {
        formData.append(
          'effective_from',
          partnerDocumentForm.effective_from,
        );
      }

      if (partnerDocumentForm.effective_to) {
        formData.append(
          'effective_to',
          partnerDocumentForm.effective_to,
        );
      }

      if (partnerDocumentForm.notes.trim()) {
        formData.append('notes', partnerDocumentForm.notes.trim());
      }

      await uploadInsurancePartnerDocument(
        token,
        tenantSlug,
        selectedDocumentPartner.id,
        formData,
      );

      setNotice('Insurance partner document uploaded successfully.');
      resetPartnerDocumentForm();
      await loadPartnerDocuments(selectedDocumentPartner);
      await loadPartners();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to upload insurance partner document.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');
    setError('');

    const payload = {
      code: partnerForm.code.trim(),
      name: partnerForm.name.trim(),
      partner_type: partnerForm.partner_type,
      pricing_mode: partnerForm.pricing_mode,
      contract_start_date: partnerForm.contract_start_date || null,
      contract_expiry_date: partnerForm.contract_expiry_date || null,
      coverage_limit: partnerForm.coverage_limit
        ? Number(partnerForm.coverage_limit)
        : null,
      external_portal_reference:
        partnerForm.external_portal_reference.trim() || null,
      requires_price_approval: partnerForm.requires_price_approval,
      contact_name: partnerForm.contact_name.trim() || null,
      contact_phone: partnerForm.phone.trim() || null,
      alternative_phone: partnerForm.alternative_phone.trim() || null,
      contact_email: partnerForm.email.trim() || null,
      default_customer_contribution_percent: Number(
        partnerForm.customer_contribution_percent,
      ),
      default_insurer_contribution_percent: Number(
        partnerForm.insurer_contribution_percent,
      ),
      status: partnerForm.status,
    };

    try {
      if (editingPartnerId) {
        await updateInsurancePartner(
          token,
          tenantSlug,
          editingPartnerId,
          payload,
        );

        setNotice('Insurance partner updated successfully.');
      } else {
        await createInsurancePartner(token, tenantSlug, payload);

        setNotice('Insurance partner created successfully.');
      }

      resetPartnerForm();
      await loadPartners();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingPartnerId
            ? 'Unable to update insurance partner.'
            : 'Unable to create insurance partner.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitInstitution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      await createInsuranceInstitution(token, tenantSlug, {
        insurance_partner_id: Number(
          institutionForm.insurance_partner_id,
        ),
        code: institutionForm.code.trim(),
        name: institutionForm.name.trim(),
        institution_type: institutionForm.institution_type,
        contact_name: institutionForm.contact_name.trim() || null,
        phone: institutionForm.phone.trim() || null,
        email: institutionForm.email.trim() || null,
        status: institutionForm.status,
      });

      setInstitutionForm((current) => ({
        ...current,
        code: '',
        name: '',
        contact_name: '',
        phone: '',
        email: '',
      }));

      setNotice('Insurance institution created successfully.');
      await loadInstitutions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create insurance institution.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitScheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      await createInsuranceScheme(token, tenantSlug, {
        insurance_partner_id: Number(schemeForm.insurance_partner_id),
        insurance_institution_id:
          schemeForm.insurance_institution_id
            ? Number(schemeForm.insurance_institution_id)
            : null,
        code: schemeForm.code.trim(),
        name: schemeForm.name.trim(),
        customer_contribution_percent: Number(
          schemeForm.customer_contribution_percent,
        ),
        insurer_contribution_percent: Number(
          schemeForm.insurer_contribution_percent,
        ),
        effective_from: schemeForm.effective_from || null,
        effective_to: schemeForm.effective_to || null,
        requires_preauthorization:
          schemeForm.requires_preauthorization,
        status: schemeForm.status,
      });

      setSchemeForm((current) => ({
        ...current,
        code: '',
        name: '',
      }));

      setNotice('Insurance scheme created successfully.');
      await loadSchemes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create insurance scheme.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitPriceList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      await createInsurancePriceList(token, tenantSlug, {
        insurance_partner_id: Number(
          priceListForm.insurance_partner_id,
        ),
        insurance_scheme_id: priceListForm.insurance_scheme_id
          ? Number(priceListForm.insurance_scheme_id)
          : null,
        code: priceListForm.code.trim(),
        name: priceListForm.name.trim(),
        currency: priceListForm.currency,
        priority: Number(priceListForm.priority),
        effective_from: priceListForm.effective_from || null,
        effective_to: priceListForm.effective_to || null,
        source_type: priceListForm.source_type || null,
        source_document_path:
          priceListForm.source_document_path.trim() || null,
        approval_status: priceListForm.approval_status,
        approval_notes: priceListForm.approval_notes.trim() || null,
        status: priceListForm.status,
      });

      setPriceListForm((current) => ({
        ...current,
        code: '',
        name: '',
      }));

      setNotice('Insurance price list created successfully.');
      await loadPriceLists();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create insurance price list.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitProductPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      await createInsuranceProductPrice(token, tenantSlug, {
        insurance_price_list_id: Number(
          productPriceForm.insurance_price_list_id,
        ),
        product_id: Number(productPriceForm.product_id),
        agreed_unit_price: Number(
          productPriceForm.covered_unit_price,
        ),
        covered_unit_price: Number(
          productPriceForm.covered_unit_price,
        ),
        standard_selling_price_snapshot:
          productPriceForm.standard_selling_price_snapshot
            ? Number(productPriceForm.standard_selling_price_snapshot)
            : null,
        pricing_source: productPriceForm.pricing_source,
        price_confidence: productPriceForm.price_confidence
          ? Number(productPriceForm.price_confidence)
          : null,
        approval_status: productPriceForm.approval_status,
        approval_notes:
          productPriceForm.approval_notes.trim() || null,
        customer_contribution_percent:
          productPriceForm.customer_contribution_percent
            ? Number(
                productPriceForm.customer_contribution_percent,
              )
            : null,
        insurer_contribution_percent:
          productPriceForm.insurer_contribution_percent
            ? Number(
                productPriceForm.insurer_contribution_percent,
              )
            : null,
        requires_preauthorization:
          productPriceForm.requires_preauthorization,
        status: productPriceForm.status,
      });

      setProductPriceForm((current) => ({
        ...current,
        product_id: '',
        covered_unit_price: '',
      }));

      setNotice('Covered product price created successfully.');
      await loadProductPrices();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create covered product price.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitContributionRule(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      await createInsuranceContributionRule(token, tenantSlug, {
        insurance_partner_id: Number(
          ruleForm.insurance_partner_id,
        ),
        insurance_institution_id:
          ruleForm.insurance_institution_id
            ? Number(ruleForm.insurance_institution_id)
            : null,
        insurance_scheme_id: ruleForm.insurance_scheme_id
          ? Number(ruleForm.insurance_scheme_id)
          : null,
        product_id: ruleForm.product_id
          ? Number(ruleForm.product_id)
          : null,
        customer_contribution_percent: Number(
          ruleForm.customer_contribution_percent,
        ),
        insurer_contribution_percent: Number(
          ruleForm.insurer_contribution_percent,
        ),
        fixed_customer_amount: ruleForm.fixed_customer_amount
          ? Number(ruleForm.fixed_customer_amount)
          : null,
        maximum_insurer_amount: ruleForm.maximum_insurer_amount
          ? Number(ruleForm.maximum_insurer_amount)
          : null,
        effective_from: ruleForm.effective_from || null,
        effective_to: ruleForm.effective_to || null,
        status: ruleForm.status,
      });

      setRuleForm((current) => ({
        ...current,
        product_id: '',
        fixed_customer_amount: '',
        maximum_insurer_amount: '',
      }));

      setNotice('Contribution rule created successfully.');
      await loadContributionRules();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create contribution rule.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const kpis = [
    {
      label: 'Insurance partners',
      value: partners.pagination?.total ?? partners.rows.length,
      hint: 'Payers and insurers configured',
    },
    {
      label: 'Institutions',
      value:
        institutions.pagination?.total ?? institutions.rows.length,
      hint: 'Employer and institutional groups',
    },
    {
      label: 'Schemes',
      value: schemes.pagination?.total ?? schemes.rows.length,
      hint: 'Coverage packages available',
    },
    {
      label: 'Price lists',
      value:
        priceLists.pagination?.total ?? priceLists.rows.length,
      hint: 'Active and historical tariffs',
    },
    {
      label: 'Covered products',
      value:
        productPrices.pagination?.total ??
        productPrices.rows.length,
      hint: 'Product-specific insurer prices',
    },
    {
      label: 'Contribution rules',
      value:
        contributionRules.pagination?.total ??
        contributionRules.rows.length,
      hint: 'Customer and insurer split rules',
    },
  ];

  function filters() {
    return (
      <div className="insurance-filter-bar">
        <label>
          Search register
          <input
            type="search"
            value={search}
            placeholder="Code, name, product or partner"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option || 'all'} value={option}>
                {option || 'All statuses'}
              </option>
            ))}
          </select>
        </label>

        <label>
          Rows
          <select
            value={perPage}
            onChange={(event) =>
              setPerPage(Number(event.target.value))
            }
          >
            {[10, 20, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void refreshCurrentWorkspace()}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    );
  }

  function overview() {
    return (
      <>
        <section className="insurance-kpi-grid">
          {kpis.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </article>
          ))}
        </section>

        <section className="insurance-overview-grid">
          <article className="insurance-card">
            <div className="section-heading">
              <div>
                <span>Implementation readiness</span>
                <h3>Insurance configuration flow</h3>
              </div>
            </div>

            <div className="insurance-readiness-list">
              {[
                [
                  '1. Partner setup',
                  'Register payer identity, contribution defaults and operating status.',
                ],
                [
                  '2. Institution mapping',
                  'Link employer or institutional groups to their insurance partner.',
                ],
                [
                  '3. Scheme configuration',
                  'Define customer contribution, insurer contribution and authorization policy.',
                ],
                [
                  '4. Price-list control',
                  'Create dated and prioritized insurer tariffs.',
                ],
                [
                  '5. Product coverage',
                  'Map covered products and approved unit prices.',
                ],
                [
                  '6. POS resolution',
                  'Resolve the payable split before sale confirmation and stock deduction.',
                ],
              ].map(([title, description]) => (
                <div key={title}>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="insurance-card">
            <div className="section-heading">
              <div>
                <span>Governance</span>
                <h3>Safe operating principles</h3>
              </div>
            </div>

            <div className="insurance-readiness-list">
              <div>
                <strong>Tenant isolated</strong>
                <span>
                  Every request includes the active tenant header.
                </span>
              </div>
              <div>
                <strong>Permission protected</strong>
                <span>
                  Access requires the dedicated insurance management
                  permission.
                </span>
              </div>
              <div>
                <strong>Audited mutations</strong>
                <span>
                  Partner and pricing changes are retained in backend
                  audit history.
                </span>
              </div>
              <div>
                <strong>No cart-stage stock deduction</strong>
                <span>
                  Insurance pricing preparation does not alter stock.
                </span>
              </div>
            </div>
          </article>
        </section>
      </>
    );
  }

  function partnersRegister() {
    return (
      <>
        <form
          className="insurance-form-card"
          onSubmit={submitPartner}
        >
          <div className="section-heading">
            <div>
              <span>Partner configuration</span>
              <h3>
                {editingPartnerId
                  ? 'Edit insurance partner'
                  : 'Create insurance partner'}
              </h3>
            </div>
          </div>

          <div className="insurance-form-grid">
            <label>
              Partner code
              <input
                required
                value={partnerForm.code}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>

            <label>
              Partner name
              <input
                required
                value={partnerForm.name}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Partner type
              <select
                value={partnerForm.partner_type}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    partner_type: event.target.value,
                  }))
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="military">Military</option>
                <option value="corporate">Corporate</option>
              </select>
            </label>

            <label>
              Pricing mode
              <select
                value={partnerForm.pricing_mode}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    pricing_mode: event.target.value,
                  }))
                }
              >
                <option value="standard">Standard pharmacy price</option>
                <option value="contract">Contract price</option>
                <option value="portal_confirmed">Portal confirmed</option>
                <option value="mixed">Mixed mode</option>
              </select>
            </label>

            <label>
              Contract start
              <input
                type="date"
                value={partnerForm.contract_start_date}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    contract_start_date: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Contract expiry
              <input
                type="date"
                value={partnerForm.contract_expiry_date}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    contract_expiry_date: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Coverage limit
              <input
                type="number"
                min="0"
                step="0.01"
                value={partnerForm.coverage_limit}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    coverage_limit: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              External portal reference
              <input
                value={partnerForm.external_portal_reference}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    external_portal_reference: event.target.value,
                  }))
                }
              />
            </label>

            <label className="insurance-checkbox-label">
              <input
                type="checkbox"
                checked={partnerForm.requires_price_approval}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    requires_price_approval: event.target.checked,
                  }))
                }
              />
              Require price approval
            </label>

            <label>
              Contact person
              <input
                value={partnerForm.contact_name}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    contact_name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Phone
              <input
                value={partnerForm.phone}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Alternative phone
              <input
                value={partnerForm.alternative_phone}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    alternative_phone: event.target.value,
                  }))
                }
                placeholder="Optional backup phone"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={partnerForm.email}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Customer contribution %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  partnerForm.customer_contribution_percent
                }
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    customer_contribution_percent:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Insurer contribution %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  partnerForm.insurer_contribution_percent
                }
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    insurer_contribution_percent:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Status
              <select
                value={partnerForm.status}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          </div>

          <section className="insurance-card">
            {selectedDocumentPartner ? (
              <div className="insurance-section-heading">
                <span className="insurance-muted">
                  Selected: {selectedDocumentPartner.name}
                </span>
              </div>
            ) : null}

            {selectedDocumentPartner ? (
              <>
                <div className="insurance-form-grid">
                  <label>
                    Document type
                    <select
                      value={partnerDocumentForm.document_type}
                      onChange={(event) =>
                        setPartnerDocumentForm((current) => ({
                          ...current,
                          document_type: event.target.value,
                        }))
                      }
                    >
                      <option value="contract">Contract</option>
                      <option value="acceptance_letter">
                        Acceptance letter
                      </option>
                      <option value="amendment">Amendment</option>
                      <option value="price_list">Price list</option>
                      <option value="claim_guide">Claim guide</option>
                      <option value="accreditation">Accreditation</option>
                      <option value="tax_registration">
                        Tax registration
                      </option>
                      <option value="logo">Insurer logo</option>
                      <option value="termination_notice">
                        Termination notice
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <label>
                    Document title
                    <input
                      value={partnerDocumentForm.title}
                      onChange={(event) =>
                        setPartnerDocumentForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Example: 2026 RSSB contract"
                    />
                  </label>

                  <label>
                    Version
                    <input
                      value={partnerDocumentForm.version}
                      onChange={(event) =>
                        setPartnerDocumentForm((current) => ({
                          ...current,
                          version: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>

                  <label>
                    Effective from
                    <input
                      type="date"
                      value={partnerDocumentForm.effective_from}
                      onChange={(event) =>
                        setPartnerDocumentForm((current) => ({
                          ...current,
                          effective_from: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Effective to
                    <input
                      type="date"
                      value={partnerDocumentForm.effective_to}
                      onChange={(event) =>
                        setPartnerDocumentForm((current) => ({
                          ...current,
                          effective_to: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Document status
                    <select
                      value={partnerDocumentForm.status}
                      onChange={(event) =>
                        setPartnerDocumentForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="expired">Expired</option>
                      <option value="replaced">Replaced</option>
                      <option value="revoked">Revoked</option>
                    </select>
                  </label>

                  <label>
                    File
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xlsx,.doc,.docx"
                      onChange={(event) =>
                        setPartnerDocumentFile(
                          event.target.files?.[0] ?? null,
                        )
                      }
                    />
                  </label>

                  <label>
                    Notes
                    <textarea
                      value={partnerDocumentForm.notes}
                      onChange={(event) =>
                        setPartnerDocumentForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Optional notes"
                    />
                  </label>

                  <label className="insurance-checkbox-label">
                    <input
                      type="checkbox"
                      checked={partnerDocumentForm.is_primary}
                      onChange={(event) =>
                        setPartnerDocumentForm((current) => ({
                          ...current,
                          is_primary: event.target.checked,
                        }))
                      }
                    />
                    Mark as primary for this document type
                  </label>
                </div>

                <div className="insurance-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Type</th>
                        <th>Effective period</th>
                        <th>Status</th>
                        <th>File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerDocuments.map((document) => (
                        <tr key={document.id}>
                          <td>
                            <strong>{document.title}</strong>
                            <small>
                              {document.version || 'No version'}
                              {document.is_primary ? ' · Primary' : ''}
                            </small>
                          </td>
                          <td>
                            {document.document_type.replace(/_/g, ' ')}
                          </td>
                          <td>
                            {document.effective_from || 'Open'} →{' '}
                            {document.effective_to || 'Open'}
                          </td>
                          <td>
                            <StatusPill status={document.status} />
                          </td>
                          <td>
                            {document.public_url ? (
                              <a
                                href={document.public_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open file
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}

                      {!partnerDocuments.length ? (
                        <tr>
                          <td colSpan={5}>
                            {isLoadingPartnerDocuments
                              ? 'Loading documents…'
                              : 'No documents uploaded for this partner yet.'}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="insurance-muted">
                Save or edit a partner first.
              </p>
            )}
          </section>

          <div className="insurance-action-grid insurance-action-grid-2x2">
            <button disabled={isSaving} type="submit">
              {isSaving
                ? 'Saving…'
                : editingPartnerId
                  ? 'Update'
                  : 'Create Partner'}
            </button>

            <button
              type="button"
              className="secondary"
              onClick={resetPartnerForm}
              disabled={isSaving}
            >
              {editingPartnerId ? 'Cancel edit' : 'Clear form'}
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() => void submitPartnerDocument()}
              disabled={isSaving || !selectedDocumentPartner}
            >
              {isSaving ? 'Uploading…' : 'Upload / attach document'}
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() =>
                selectedDocumentPartner
                  ? void loadPartnerDocuments(selectedDocumentPartner)
                  : undefined
              }
              disabled={isSaving || !selectedDocumentPartner}
            >
              Refresh documents
            </button>
          </div>
        </form>

        {filters()}

        <div className="insurance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th>Type</th>
                <th>Pricing mode</th>
                <th>Contract</th>
                <th>Contribution split</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.rows.map((partner) => (
                <tr key={partner.id}>
                  <td>
                    <strong>{partner.name}</strong>
                    <small>{partner.code}</small>
                  </td>
                  <td>{partner.partner_type || '—'}</td>
                  <td>
                    {partner.pricing_mode || 'standard'}
                    {partner.requires_price_approval ? (
                      <small>Approval required</small>
                    ) : null}
                  </td>
                  <td>
                    {partner.contract_start_date || 'Open'} →{' '}
                    {partner.contract_expiry_date || 'Open'}
                    {partner.coverage_limit ? (
                      <small>Limit RWF {money(partner.coverage_limit)}</small>
                    ) : null}
                  </td>
                  <td>
                    {contribution(
                      partner.default_customer_contribution_percent,
                      partner.default_insurer_contribution_percent,
                    )}
                  </td>
                  <td>
                    <strong>{partner.contact_name || '—'}</strong>
                    <small>
                      {partner.contact_phone ||
                        partner.phone ||
                        'No primary phone'}
                      {partner.alternative_phone ? (
                        <small>Alt: {partner.alternative_phone}</small>
                      ) : null}
                      <small>
                        {partner.contact_email ||
                          partner.email ||
                          'No email'}
                      </small>
                    </small>
                  </td>
                  <td>
                    <StatusPill status={partner.status} />
                  </td>
                  <td>
                    <div className="insurance-action-grid insurance-action-grid-2x2 compact">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => loadPartnerForEdit(partner)}
                        disabled={isSaving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void loadPartnerDocuments(partner)}
                        disabled={isSaving}
                      >
                        Documents
                      </button>
                      {partner.status === 'active' ? (
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            changePartnerStatus(partner, 'suspended')
                          }
                          disabled={isSaving}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            changePartnerStatus(partner, 'active')
                          }
                          disabled={isSaving}
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => replicatePartner(partner)}
                        disabled={isSaving}
                      >
                        Replicate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!partners.rows.length && (
                <tr>
                  <td colSpan={8}>
                    No insurance partners match the current
                    filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          pagination={partners.pagination}
          onPageChange={setPage}
        />


      </>
    );
  }

  function institutionsRegister() {
    return (
      <>
        <form
          className="insurance-form-card"
          onSubmit={submitInstitution}
        >
          <div className="section-heading">
            <div>
              <span>Institution mapping</span>
              <h3>Add covered institution</h3>
            </div>
          </div>

          <div className="insurance-form-grid">
            <label>
              Partner
              <select
                required
                value={
                  institutionForm.insurance_partner_id
                }
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    insurance_partner_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">Select partner</option>
                {partners.rows.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} — {partner.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Institution code
              <input
                required
                value={institutionForm.code}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>

            <label>
              Institution name
              <input
                required
                value={institutionForm.name}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Institution type
              <select
                value={institutionForm.institution_type}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    institution_type: event.target.value,
                  }))
                }
              >
                <option value="employer">Employer</option>
                <option value="public">Public institution</option>
                <option value="private">Private institution</option>
                <option value="affiliate">Affiliate</option>
              </select>
            </label>

            <label>
              Contact person
              <input
                value={institutionForm.contact_name}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    contact_name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Phone
              <input
                value={institutionForm.phone}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={institutionForm.email}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Status
              <select
                value={institutionForm.status}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <button disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : 'Create institution'}
          </button>
        </form>

        {filters()}

        <div className="insurance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Partner</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {institutions.rows.map((institution) => (
                <tr key={institution.id}>
                  <td>
                    <strong>{institution.name}</strong>
                    <small>{institution.code}</small>
                  </td>
                  <td>
                    {institution.partner?.name ||
                      institution.insurance_partner_id}
                  </td>
                  <td>{institution.institution_type || '—'}</td>
                  <td>
                    <strong>
                      {institution.contact_name || '—'}
                    </strong>
                    <small>
                      {institution.phone ||
                        institution.email ||
                        'No contact'}
                    </small>
                  </td>
                  <td>
                    <StatusPill status={institution.status} />
                  </td>
                </tr>
              ))}

              {!institutions.rows.length && (
                <tr>
                  <td colSpan={5}>
                    No institutions match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          pagination={institutions.pagination}
          onPageChange={setPage}
        />
      </>
    );
  }

  function schemesRegister() {
    return (
      <>
        <form
          className="insurance-form-card"
          onSubmit={submitScheme}
        >
          <div className="section-heading">
            <div>
              <span>Coverage configuration</span>
              <h3>Add insurance scheme</h3>
            </div>
          </div>

          <div className="insurance-form-grid">
            <label>
              Partner
              <select
                required
                value={schemeForm.insurance_partner_id}
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    insurance_partner_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">Select partner</option>
                {partners.rows.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} — {partner.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Institution
              <select
                value={schemeForm.insurance_institution_id}
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    insurance_institution_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">Partner-level scheme</option>
                {institutions.rows.map((institution) => (
                  <option
                    key={institution.id}
                    value={institution.id}
                  >
                    {institution.code} — {institution.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Scheme code
              <input
                required
                value={schemeForm.code}
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>

            <label>
              Scheme name
              <input
                required
                value={schemeForm.name}
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Customer %
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  schemeForm.customer_contribution_percent
                }
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    customer_contribution_percent:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Insurer %
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  schemeForm.insurer_contribution_percent
                }
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    insurer_contribution_percent:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Effective from
              <input
                type="date"
                value={schemeForm.effective_from}
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    effective_from: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Effective to
              <input
                type="date"
                value={schemeForm.effective_to}
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    effective_to: event.target.value,
                  }))
                }
              />
            </label>

            <label className="insurance-checkbox-label">
              <input
                type="checkbox"
                checked={schemeForm.requires_preauthorization}
                onChange={(event) =>
                  setSchemeForm((current) => ({
                    ...current,
                    requires_preauthorization:
                      event.target.checked,
                  }))
                }
              />
              Requires preauthorization
            </label>
          </div>

          <button disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : 'Create scheme'}
          </button>
        </form>

        {filters()}

        <div className="insurance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Scheme</th>
                <th>Partner</th>
                <th>Institution</th>
                <th>Contribution split</th>
                <th>Effective period</th>
                <th>Authorization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schemes.rows.map((scheme) => (
                <tr key={scheme.id}>
                  <td>
                    <strong>{scheme.name}</strong>
                    <small>{scheme.code}</small>
                  </td>
                  <td>
                    {scheme.partner?.name ||
                      scheme.insurance_partner_id}
                  </td>
                  <td>
                    {scheme.institution?.name ||
                      scheme.insurance_institution_id ||
                      'Partner level'}
                  </td>
                  <td>
                    {contribution(
                      scheme.customer_contribution_percent,
                      scheme.insurer_contribution_percent,
                    )}
                  </td>
                  <td>
                    {scheme.effective_from || 'Open'} →{' '}
                    {scheme.effective_to || 'Open'}
                  </td>
                  <td>
                    {scheme.requires_preauthorization
                      ? 'Required'
                      : 'Not required'}
                  </td>
                  <td>
                    <StatusPill status={scheme.status} />
                  </td>
                </tr>
              ))}

              {!schemes.rows.length && (
                <tr>
                  <td colSpan={7}>
                    No schemes match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          pagination={schemes.pagination}
          onPageChange={setPage}
        />
      </>
    );
  }

  function priceListsRegister() {
    return (
      <>
        <form
          className="insurance-form-card"
          onSubmit={submitPriceList}
        >
          <div className="section-heading">
            <div>
              <span>Tariff management</span>
              <h3>Add insurance price list</h3>
            </div>
          </div>

          <div className="insurance-form-grid">
            <label>
              Partner
              <select
                required
                value={priceListForm.insurance_partner_id}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    insurance_partner_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">Select partner</option>
                {partners.rows.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} — {partner.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Scheme
              <select
                value={priceListForm.insurance_scheme_id}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    insurance_scheme_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">Partner-wide price list</option>
                {schemes.rows.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.code} — {scheme.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Price-list code
              <input
                required
                value={priceListForm.code}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>

            <label>
              Price-list name
              <input
                required
                value={priceListForm.name}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Currency
              <input
                value={priceListForm.currency}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>

            <label>
              Priority
              <input
                type="number"
                min="0"
                value={priceListForm.priority}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Effective from
              <input
                type="date"
                value={priceListForm.effective_from}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    effective_from: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Effective to
              <input
                type="date"
                value={priceListForm.effective_to}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    effective_to: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Source type
              <select
                value={priceListForm.source_type}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    source_type: event.target.value,
                  }))
                }
              >
                <option value="manual">Manual</option>
                <option value="contract">Contract</option>
                <option value="portal">Portal</option>
                <option value="import">Import</option>
                <option value="ai_extract">AI extraction</option>
              </select>
            </label>

            <label>
              Source document path
              <input
                value={priceListForm.source_document_path}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    source_document_path: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Approval status
              <select
                value={priceListForm.approval_status}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    approval_status: event.target.value,
                  }))
                }
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </label>

            <label>
              Approval notes
              <input
                value={priceListForm.approval_notes}
                onChange={(event) =>
                  setPriceListForm((current) => ({
                    ...current,
                    approval_notes: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <button disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : 'Create price list'}
          </button>
        </form>

        {filters()}

        <div className="insurance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Price list</th>
                <th>Partner</th>
                <th>Scheme</th>
                <th>Currency</th>
                <th>Priority</th>
                <th>Effective period</th>
                <th>Source</th>
                <th>Approval</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {priceLists.rows.map((priceList) => (
                <tr key={priceList.id}>
                  <td>
                    <strong>{priceList.name}</strong>
                    <small>{priceList.code}</small>
                  </td>
                  <td>
                    {priceList.partner?.name ||
                      priceList.insurance_partner_id}
                  </td>
                  <td>
                    {priceList.scheme?.name ||
                      priceList.insurance_scheme_id ||
                      'Partner wide'}
                  </td>
                  <td>{priceList.currency || 'RWF'}</td>
                  <td>{priceList.priority ?? 0}</td>
                  <td>
                    {priceList.effective_from || 'Open'} →{' '}
                    {priceList.effective_to || 'Open'}
                  </td>
                  <td>
                    {priceList.source_type || 'manual'}
                    {priceList.source_document_path ? (
                      <small>{priceList.source_document_path}</small>
                    ) : null}
                  </td>
                  <td>
                    <StatusPill
                      status={priceList.approval_status || 'pending'}
                    />
                    {priceList.approved_at ? (
                      <small>{priceList.approved_at}</small>
                    ) : null}
                  </td>
                  <td>
                    <StatusPill status={priceList.status} />
                  </td>
                </tr>
              ))}

              {!priceLists.rows.length && (
                <tr>
                  <td colSpan={9}>
                    No price lists match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          pagination={priceLists.pagination}
          onPageChange={setPage}
        />
      </>
    );
  }

  function productPricesRegister() {
    return (
      <>
        <form
          className="insurance-form-card"
          onSubmit={submitProductPrice}
        >
          <div className="section-heading">
            <div>
              <span>Covered product pricing</span>
              <h3>Add product insurance price</h3>
            </div>
          </div>

          <div className="insurance-form-grid">
            <label>
              Price list
              <select
                required
                value={
                  productPriceForm.insurance_price_list_id
                }
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    insurance_price_list_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">Select price list</option>
                {priceLists.rows.map((priceList) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.code} — {priceList.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Product ID
              <input
                required
                type="number"
                min="1"
                value={productPriceForm.product_id}
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    product_id: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Covered unit price
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={productPriceForm.covered_unit_price}
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    covered_unit_price: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Standard pharmacy price
              <input
                type="number"
                min="0"
                step="0.01"
                value={productPriceForm.standard_selling_price_snapshot}
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    standard_selling_price_snapshot: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Pricing source
              <select
                value={productPriceForm.pricing_source}
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    pricing_source: event.target.value,
                  }))
                }
              >
                <option value="contract_price_list">Contract price list</option>
                <option value="portal_confirmed">Portal confirmed</option>
                <option value="manual_override">Manual override</option>
                <option value="ai_suggested">AI suggested</option>
                <option value="standard">Standard</option>
              </select>
            </label>

            <label>
              Price confidence %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={productPriceForm.price_confidence}
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    price_confidence: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Approval status
              <select
                value={productPriceForm.approval_status}
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    approval_status: event.target.value,
                  }))
                }
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </label>

            <label>
              Approval notes
              <input
                value={productPriceForm.approval_notes}
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    approval_notes: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Customer contribution %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  productPriceForm.customer_contribution_percent
                }
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    customer_contribution_percent:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Insurer contribution %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  productPriceForm.insurer_contribution_percent
                }
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    insurer_contribution_percent:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label className="insurance-checkbox-label">
              <input
                type="checkbox"
                checked={
                  productPriceForm.requires_preauthorization
                }
                onChange={(event) =>
                  setProductPriceForm((current) => ({
                    ...current,
                    requires_preauthorization:
                      event.target.checked,
                  }))
                }
              />
              Requires preauthorization
            </label>
          </div>

          <button disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : 'Create product price'}
          </button>
        </form>

        {filters()}

        <div className="insurance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Price list</th>
                <th>Covered price</th>
                <th>Standard price</th>
                <th>Difference</th>
                <th>Contribution split</th>
                <th>Source</th>
                <th>Approval</th>
                <th>Authorization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {productPrices.rows.map((productPrice) => (
                <tr key={productPrice.id}>
                  <td>
                    <strong>
                      {productPrice.product?.name ||
                        `Product #${productPrice.product_id}`}
                    </strong>
                    <small>
                      {productPrice.product?.sku || 'No SKU'}
                    </small>
                  </td>
                  <td>
                    {productPrice.price_list?.name ||
                      productPrice.insurance_price_list_id}
                  </td>
                  <td>
                    RWF {money(productPrice.agreed_unit_price ?? productPrice.covered_unit_price)}
                  </td>
                  <td>
                    RWF {money(productPrice.standard_selling_price_snapshot)}
                  </td>
                  <td>
                    RWF {money(productPrice.price_difference_amount)}
                    <small>
                      {money(productPrice.price_difference_percentage)}%
                    </small>
                  </td>
                  <td>
                    {contribution(
                      productPrice.customer_contribution_percent,
                      productPrice.insurer_contribution_percent,
                    )}
                  </td>
                  <td>
                    {productPrice.pricing_source || 'contract_price_list'}
                    {productPrice.price_confidence ? (
                      <small>{money(productPrice.price_confidence)}% confidence</small>
                    ) : null}
                  </td>
                  <td>
                    <StatusPill
                      status={productPrice.approval_status || 'pending'}
                    />
                    {productPrice.approved_at ? (
                      <small>{productPrice.approved_at}</small>
                    ) : null}
                  </td>
                  <td>
                    {productPrice.requires_pre_authorization ||
                    productPrice.requires_preauthorization
                      ? 'Required'
                      : 'Not required'}
                  </td>
                  <td>
                    <StatusPill
                      status={productPrice.coverage_status || productPrice.status}
                    />
                  </td>
                </tr>
              ))}

              {!productPrices.rows.length && (
                <tr>
                  <td colSpan={10}>
                    No covered product prices match the current
                    filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          pagination={productPrices.pagination}
          onPageChange={setPage}
        />
      </>
    );
  }

  function salesRegisterWorkspace() {
    const totals = salesRegister.rows.reduce(
      (summary, row) => ({
        gross:
          summary.gross + Number(row.gross_amount ?? 0),
        customer:
          summary.customer +
          Number(row.customer_contribution_amount ?? 0),
        insurer:
          summary.insurer + Number(row.insurer_claim_amount ?? 0),
      }),
      { gross: 0, customer: 0, insurer: 0 },
    );

    return (
      <>
        <section className="insurance-form-card">
          <div className="section-heading">
            <div>
              <span>Insurance sale evidence</span>
              <h3>Sales register by partner, institution and scheme</h3>
              <p>
                Review accumulated insured sales used to prepare claim
                invoices and supporting annexes.
              </p>
            </div>
          </div>

          <div className="insurance-form-grid">
            <label>
              Partner
              <select
                value={salesRegisterFilters.insurance_partner_id}
                onChange={(event) => {
                  setPage(1);
                  setSalesRegisterFilters((current) => ({
                    ...current,
                    insurance_partner_id: event.target.value,
                  }));
                }}
              >
                <option value="">All partners</option>
                {partners.rows.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} — {partner.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Institution
              <select
                value={salesRegisterFilters.insurance_institution_id}
                onChange={(event) => {
                  setPage(1);
                  setSalesRegisterFilters((current) => ({
                    ...current,
                    insurance_institution_id: event.target.value,
                  }));
                }}
              >
                <option value="">All institutions</option>
                {institutions.rows.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.code} — {institution.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Scheme
              <select
                value={salesRegisterFilters.insurance_scheme_id}
                onChange={(event) => {
                  setPage(1);
                  setSalesRegisterFilters((current) => ({
                    ...current,
                    insurance_scheme_id: event.target.value,
                  }));
                }}
              >
                <option value="">All schemes</option>
                {schemes.rows.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.code} — {scheme.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Claim status
              <select
                value={salesRegisterFilters.claim_status}
                onChange={(event) => {
                  setPage(1);
                  setSalesRegisterFilters((current) => ({
                    ...current,
                    claim_status: event.target.value,
                  }));
                }}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="partially_paid">Partially paid</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <label>
              From
              <input
                type="date"
                value={salesRegisterFilters.from}
                onChange={(event) => {
                  setPage(1);
                  setSalesRegisterFilters((current) => ({
                    ...current,
                    from: event.target.value,
                  }));
                }}
              />
            </label>

            <label>
              To
              <input
                type="date"
                value={salesRegisterFilters.to}
                onChange={(event) => {
                  setPage(1);
                  setSalesRegisterFilters((current) => ({
                    ...current,
                    to: event.target.value,
                  }));
                }}
              />
            </label>
          </div>

          <div className="insurance-action-row">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void loadSalesRegister()}
            >
              {isLoading ? 'Loading…' : 'Refresh sales register'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setPage(1);
                setSalesRegisterFilters({
                  insurance_partner_id: '',
                  insurance_institution_id: '',
                  insurance_scheme_id: '',
                  claim_status: '',
                  from: '',
                  to: '',
                });
              }}
            >
              Clear filters
            </button>
          </div>
        </section>

        <div className="insurance-live-summary">
          <article>
            <span>Rows</span>
            <strong>{salesRegister.rows.length}</strong>
          </article>
          <article>
            <span>Gross sales</span>
            <strong>{money(totals.gross)} RWF</strong>
          </article>
          <article>
            <span>Customer contribution</span>
            <strong>{money(totals.customer)} RWF</strong>
          </article>
          <article>
            <span>Insurer claim</span>
            <strong>{money(totals.insurer)} RWF</strong>
          </article>
        </div>

        <div className="insurance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sale</th>
                <th>Date</th>
                <th>Partner / Institution</th>
                <th>Scheme</th>
                <th>Member / Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Gross</th>
                <th>Customer</th>
                <th>Insurer</th>
                <th>Claim</th>
              </tr>
            </thead>
            <tbody>
              {salesRegister.rows.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.sale_number || '—'}</strong>
                    <small>{entry.uuid || ''}</small>
                  </td>
                  <td>{entry.sale_date || '—'}</td>
                  <td>
                    <strong>{entry.partner?.name || '—'}</strong>
                    <small>{entry.institution?.name || 'No institution'}</small>
                  </td>
                  <td>{entry.scheme?.name || '—'}</td>
                  <td>
                    <strong>{entry.member_number || '—'}</strong>
                    <small>{entry.customer_name || 'No customer snapshot'}</small>
                  </td>
                  <td>{entry.product_name || '—'}</td>
                  <td>{money(entry.quantity)}</td>
                  <td>{money(entry.gross_amount)}</td>
                  <td>{money(entry.customer_contribution_amount)}</td>
                  <td>{money(entry.insurer_claim_amount)}</td>
                  <td>
                    <strong>{entry.claim_number || 'Not generated'}</strong>
                    <small>{entry.claim_status || 'pending'}</small>
                  </td>
                </tr>
              ))}

              {!salesRegister.rows.length && (
                <tr>
                  <td colSpan={11}>
                    No insurance sales register entries match the current
                    filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          pagination={salesRegister.pagination}
          onPageChange={setPage}
        />
      </>
    );
  }

  function contributionRulesRegister() {
    return (
      <>
        <form
          className="insurance-form-card"
          onSubmit={submitContributionRule}
        >
          <div className="section-heading">
            <div>
              <span>Contribution hierarchy</span>
              <h3>Add contribution rule</h3>
            </div>
          </div>

          <div className="insurance-form-grid">
            <label>
              Partner
              <select
                required
                value={ruleForm.insurance_partner_id}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    insurance_partner_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">Select partner</option>
                {partners.rows.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} — {partner.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Institution
              <select
                value={ruleForm.insurance_institution_id}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    insurance_institution_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">No institution override</option>
                {institutions.rows.map((institution) => (
                  <option
                    key={institution.id}
                    value={institution.id}
                  >
                    {institution.code} — {institution.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Scheme
              <select
                value={ruleForm.insurance_scheme_id}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    insurance_scheme_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">No scheme override</option>
                {schemes.rows.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.code} — {scheme.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Product ID
              <input
                type="number"
                min="1"
                value={ruleForm.product_id}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    product_id: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Customer %
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  ruleForm.customer_contribution_percent
                }
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    customer_contribution_percent:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Insurer %
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  ruleForm.insurer_contribution_percent
                }
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    insurer_contribution_percent:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Fixed customer amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={ruleForm.fixed_customer_amount}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    fixed_customer_amount:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Maximum insurer amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={ruleForm.maximum_insurer_amount}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    maximum_insurer_amount:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Effective from
              <input
                type="date"
                value={ruleForm.effective_from}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    effective_from: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Effective to
              <input
                type="date"
                value={ruleForm.effective_to}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    effective_to: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <button disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : 'Create rule'}
          </button>
        </form>

        {filters()}

        <div className="insurance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Scope</th>
                <th>Partner</th>
                <th>Contribution split</th>
                <th>Fixed customer</th>
                <th>Insurer cap</th>
                <th>Effective period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contributionRules.rows.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <strong>
                      {rule.product?.name
                        ? `Product: ${rule.product.name}`
                        : rule.scheme?.name
                          ? `Scheme: ${rule.scheme.name}`
                          : rule.institution?.name
                            ? `Institution: ${rule.institution.name}`
                            : 'Partner default'}
                    </strong>
                    <small>
                      {rule.product?.sku ||
                        rule.scheme?.code ||
                        rule.institution?.code ||
                        'General rule'}
                    </small>
                  </td>
                  <td>
                    {rule.partner?.name ||
                      rule.insurance_partner_id}
                  </td>
                  <td>
                    {contribution(
                      rule.customer_contribution_percent,
                      rule.insurer_contribution_percent,
                    )}
                  </td>
                  <td>
                    {rule.fixed_customer_amount
                      ? `RWF ${money(
                          rule.fixed_customer_amount,
                        )}`
                      : '—'}
                  </td>
                  <td>
                    {rule.maximum_insurer_amount
                      ? `RWF ${money(
                          rule.maximum_insurer_amount,
                        )}`
                      : '—'}
                  </td>
                  <td>
                    {rule.effective_from || 'Open'} →{' '}
                    {rule.effective_to || 'Open'}
                  </td>
                  <td>
                    <StatusPill status={rule.status} />
                  </td>
                </tr>
              ))}

              {!contributionRules.rows.length && (
                <tr>
                  <td colSpan={7}>
                    No contribution rules match the current
                    filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          pagination={contributionRules.pagination}
          onPageChange={setPage}
        />
      </>
    );
  }

  function readinessWorkspace(
    title: string,
    description: string,
    items: Array<[string, string]>,
  ) {
    return (
      <section className="insurance-overview-grid">
        <article className="insurance-card insurance-card--wide">
          <div className="section-heading">
            <div>
              <span>Controlled rollout</span>
              <h3>{title}</h3>
            </div>
          </div>

          <p className="muted">{description}</p>

          <div className="insurance-readiness-list">
            {items.map(([heading, body]) => (
              <div key={heading}>
                <strong>{heading}</strong>
                <span>{body}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    );
  }

  let content = overview();

  if (activeWorkspace === 'partners') {
    content = partnersRegister();
  } else if (activeWorkspace === 'institutions') {
    content = institutionsRegister();
  } else if (activeWorkspace === 'schemes') {
    content = schemesRegister();
  } else if (activeWorkspace === 'price-lists') {
    content = priceListsRegister();
  } else if (activeWorkspace === 'product-prices') {
    content = productPricesRegister();
  } else if (activeWorkspace === 'contribution-rules') {
    content = contributionRulesRegister();
  } else if (activeWorkspace === 'claims-readiness') {
    content = (
      <InsuranceClaimsReconciliationWorkspace
        token={token}
        tenantSlug={tenantSlug}
        mode="claims"
      />
    );
  } else if (
    activeWorkspace === 'reconciliation-readiness'
  ) {
    content = (
      <InsuranceClaimsReconciliationWorkspace
        token={token}
        tenantSlug={tenantSlug}
        mode="reconciliation"
      />
    );
  } else if (activeWorkspace === 'sales-register') {
    content = salesRegisterWorkspace();
  } else if (activeWorkspace === 'audit-readiness') {
    content = readinessWorkspace(
      'Insurance audit readiness',
      'Configuration mutations are already audited by the backend. The frontend audit register will later expose searchable before-and-after evidence.',
      [
        [
          'Configuration events',
          'Partner, institution, scheme, price-list and contribution changes.',
        ],
        [
          'Pricing resolution evidence',
          'Source price, contribution precedence and fallback decisions.',
        ],
        [
          'Claims events',
          'Submission, review, acceptance, rejection and resubmission history.',
        ],
        [
          'Reconciliation events',
          'Batch creation, matching, adjustments and payment posting.',
        ],
      ],
    );
  }

  return (
    <section className="insurance-management-workspace">
      <section className="insurance-hero">
        <div>
          <p className="eyebrow">PharmaCore 360</p>
          <h2>Insurance Management</h2>
          <p>
            Configure partners, institutional groups, schemes,
            covered prices and customer contribution rules while
            preserving tenant isolation, auditability and safe POS
            confirmation.
          </p>
        </div>

        <div className="insurance-hero-actions">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleBootstrap()}
          >
            {isSaving
              ? 'Initializing…'
              : 'Initialize standard partners'}
          </button>

          <button
            type="button"
            onClick={() => onWorkspaceChange('overview')}
          >
            Insurance overview
          </button>
        </div>
      </section>

      <nav
        className="insurance-workspace-tabs"
        aria-label="Insurance management pages"
      >
        {[
          ['overview', 'Overview'],
          ['partners', 'Partners'],
          ['institutions', 'Institutions'],
          ['schemes', 'Schemes'],
          ['price-lists', 'Price Lists'],
          ['product-prices', 'Product Prices'],
          ['contribution-rules', 'Contribution Rules'],
          ['claims-readiness', 'Claims'],
          ['reconciliation-readiness', 'Reconciliation'],
          ['sales-register', 'Sales Register'],
          ['audit-readiness', 'Audit'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={
              activeWorkspace === key ? 'active' : ''
            }
            onClick={() =>
              onWorkspaceChange(key as InsuranceWorkspaceKey)
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {notice && (
        <div className="insurance-message success">{notice}</div>
      )}

      {error && (
        <div className="insurance-message error">{error}</div>
      )}

      <section className="insurance-workspace-content">
        {content}
      </section>
    </section>
  );
}

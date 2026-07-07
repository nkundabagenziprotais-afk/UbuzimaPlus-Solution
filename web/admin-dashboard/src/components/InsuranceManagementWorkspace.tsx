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
  InsurancePriceList,
  InsuranceProductPrice,
  InsuranceScheme,
  bootstrapInsuranceDefaults,
  createInsuranceContributionRule,
  createInsuranceInstitution,
  createInsurancePartner,
  createInsurancePriceList,
  createInsuranceProductPrice,
  createInsuranceScheme,
  getInsuranceContributionRules,
  getInsuranceInstitutions,
  getInsurancePartners,
  getInsurancePriceLists,
  getInsuranceProductPrices,
  getInsuranceSchemes,
} from '../lib/insuranceApi';

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

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [partnerForm, setPartnerForm] = useState({
    code: '',
    name: '',
    partner_type: 'public',
    contact_name: '',
    phone: '',
    email: '',
    customer_contribution_percent: '15',
    insurer_contribution_percent: '85',
    status: 'active',
  });

  const [institutionForm, setInstitutionForm] = useState({
    insurance_partner_id: '',
    code: '',
    name: '',
    institution_type: 'employer',
    contact_name: '',
    phone: '',
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
    status: 'active',
  });

  const [productPriceForm, setProductPriceForm] = useState({
    insurance_price_list_id: '',
    product_id: '',
    covered_unit_price: '',
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

  async function submitPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');
    setError('');

    try {
      await createInsurancePartner(token, tenantSlug, {
        code: partnerForm.code.trim(),
        name: partnerForm.name.trim(),
        partner_type: partnerForm.partner_type,
        contact_name: partnerForm.contact_name.trim() || null,
        phone: partnerForm.phone.trim() || null,
        email: partnerForm.email.trim() || null,
        default_customer_contribution_percent: Number(
          partnerForm.customer_contribution_percent,
        ),
        default_insurer_contribution_percent: Number(
          partnerForm.insurer_contribution_percent,
        ),
        status: partnerForm.status,
      });

      setPartnerForm((current) => ({
        ...current,
        code: '',
        name: '',
        contact_name: '',
        phone: '',
        email: '',
      }));

      setNotice('Insurance partner created successfully.');
      await loadPartners();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
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
        covered_unit_price: Number(
          productPriceForm.covered_unit_price,
        ),
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
              <h3>Add insurance partner</h3>
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
              </select>
            </label>
          </div>

          <button disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : 'Create partner'}
          </button>
        </form>

        {filters()}

        <div className="insurance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th>Type</th>
                <th>Contribution split</th>
                <th>Contact</th>
                <th>Status</th>
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
                    {contribution(
                      partner.default_customer_contribution_percent,
                      partner.default_insurer_contribution_percent,
                    )}
                  </td>
                  <td>
                    <strong>{partner.contact_name || '—'}</strong>
                    <small>
                      {partner.phone ||
                        partner.email ||
                        'No contact'}
                    </small>
                  </td>
                  <td>
                    <StatusPill status={partner.status} />
                  </td>
                </tr>
              ))}

              {!partners.rows.length && (
                <tr>
                  <td colSpan={5}>
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
                    <StatusPill status={priceList.status} />
                  </td>
                </tr>
              ))}

              {!priceLists.rows.length && (
                <tr>
                  <td colSpan={7}>
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
                <th>Contribution split</th>
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
                    RWF {money(productPrice.covered_unit_price)}
                  </td>
                  <td>
                    {contribution(
                      productPrice.customer_contribution_percent,
                      productPrice.insurer_contribution_percent,
                    )}
                  </td>
                  <td>
                    {productPrice.requires_preauthorization
                      ? 'Required'
                      : 'Not required'}
                  </td>
                  <td>
                    <StatusPill status={productPrice.status} />
                  </td>
                </tr>
              ))}

              {!productPrices.rows.length && (
                <tr>
                  <td colSpan={6}>
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
    content = readinessWorkspace(
      'Claims management readiness',
      'The data foundation already includes claims and claim-line records. The next controlled stage will connect eligible confirmed sales to claim preparation without changing stock during cart activity.',
      [
        [
          'Eligibility validation',
          'Validate membership, scheme, covered medicine and service date.',
        ],
        [
          'Claim preparation',
          'Create claim headers and claim lines from confirmed dispensing evidence.',
        ],
        [
          'Submission control',
          'Track draft, submitted, accepted, rejected and resubmission states.',
        ],
        [
          'Exception review',
          'Surface missing authorization, expired membership and tariff mismatch.',
        ],
      ],
    );
  } else if (
    activeWorkspace === 'reconciliation-readiness'
  ) {
    content = readinessWorkspace(
      'Reconciliation readiness',
      'Reconciliation will match submitted claims, insurer remittances, rejected lines, adjustments and outstanding balances.',
      [
        [
          'Batch preparation',
          'Group claims by partner, scheme and billing period.',
        ],
        [
          'Remittance matching',
          'Match insurer payments to accepted claim lines.',
        ],
        [
          'Variance review',
          'Identify short payments, denied lines and unexplained adjustments.',
        ],
        [
          'Finance handoff',
          'Post reconciled insurer receipts into controlled receivable records.',
        ],
      ],
    );
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

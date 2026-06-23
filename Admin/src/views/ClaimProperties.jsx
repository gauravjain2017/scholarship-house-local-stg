import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { claimPropertiesAPI } from '../api/claimProperties';
import { useHasPermission } from '../utils/roles';
import { useAuth } from '../contexts/AuthContext';
import globalVariable from '../utils/globalVariable';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import Textarea from '../components/Textarea';
import '../styles/main.css';

const ITEMS_PER_PAGE = 10;

const STATUS_FILTERS = [
  { value: 'All', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// Status badge styling + labels, shared by the clickable Status cell.
const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  approved: 'bg-green-100 text-green-700 border border-green-200',
  rejected: 'bg-red-100 text-red-700 border border-red-200',
};
const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

// Price formatter — matches /admin/properties (PropertyManagement.jsx).
const formatPrice = (price) => {
  const parsed = parseFloat(price);
  if (isNaN(parsed) || !price) return 'Not set';
  return parseInt(parsed).toLocaleString('en-US');
};

// Compute the display Property ID from street address + postal code —
// identical to the helper used on /admin/properties.
const getPropertyId = (p = {}) => {
  const streetNum = (p.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
  const postal = (p.postalCode || '').trim();
  if (!streetNum && !postal) return '';
  if (!streetNum) return postal;
  if (!postal) return streetNum;
  return `${streetNum}-${postal}`;
};

const SortableHeader = ({ label, field, sortField, sortDirection, onSort, className = '' }) => (
  <th
    className={`px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase cursor-pointer select-none hover:text-text-primary transition-colors ${className}`}
    onClick={() => onSort(field)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {sortField === field ? (
        <span className="text-text-primary">{sortDirection === 'asc' ? '▲' : '▼'}</span>
      ) : (
        <span className="opacity-30">▲</span>
      )}
    </span>
  </th>
);

const Pagination = ({ currentPage, totalItems, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="px-6 py-4 bg-surface border-t border-border-subtle flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-app disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      {getPages().map((page, i) =>
        page === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-text-secondary text-sm">…</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              currentPage === page
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:bg-app'
            }`}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === Math.ceil(totalItems / ITEMS_PER_PAGE)}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-app disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  );
};

const ClaimProperties = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canApprove = useHasPermission('claim_property.approve_claim_property');
  const canReject = useHasPermission('claim_property.reject_claim_property');

  // Visibility rule:
  //   - super_admin emails (see utils/globalVariable.js) → see all claims
  //   - anyone else (team_member, etc.) → see only claims whose
  //     specialistEmail matches their own email
  const userEmail = (user?.email || '').toLowerCase();
  const seesAll = globalVariable.super_admin.map((e) => e.toLowerCase()).includes(userEmail);

  const [filters, setFilters] = useState({ search: '', status: 'All' });
  const [sortField, setSortField] = useState('claimDate');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);

  // Approve modal
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveNotes, setApproveNotes] = useState('');

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Settings dropdown
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['claimProperties'],
    queryFn: claimPropertiesAPI.getAll,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const claims = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.data)
    ? rawData.data
    : Array.isArray(rawData?.items)
    ? rawData.items
    : [];

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => claimPropertiesAPI.approve(id, notes),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['claimProperties'] });
      toast.success('Claim approved successfully');
      setApproveTarget(null);
      setApproveNotes('');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to approve claim');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => claimPropertiesAPI.reject(id, reason),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['claimProperties'] });
      toast.success('Claim rejected');
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to reject claim');
    },
  });

  const pendingMutation = useMutation({
    mutationFn: ({ id }) => claimPropertiesAPI.updateStatus(id, 'pending'),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['claimProperties'] });
      toast.success('Claim set back to pending');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to update claim');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }) => claimPropertiesAPI.remove(id),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['claimProperties'] });
      toast.success('Claim deleted');
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to delete claim');
    },
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
  };

  // Filter

  
  const scoped = seesAll ? claims: claims.filter(
        (c) => (c.specialistEmail || '').toLowerCase() === userEmail
      );

  const filtered = scoped.filter((c) => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch =
      !filters.search ||
      c.id?.toString().toLowerCase().includes(searchLower) ||
      c.propertyId?.toString().toLowerCase().includes(searchLower) ||
      c.property?.title?.toLowerCase().includes(searchLower) ||
      c.property?.streetAddress?.toLowerCase().includes(searchLower) ||
      c.clientName?.toLowerCase().includes(searchLower) ||
      c.clientEmail?.toLowerCase().includes(searchLower);

    const matchesStatus = filters.status === 'All' || (c.status || 'pending') === filters.status;
    // Hide claims whose underlying property has been deleted — the backend
    // returns `property: null` when the properties row no longer exists.
    const hasProperty = !!c.property;
    return hasProperty && matchesSearch && matchesStatus;
  });
  

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === 'claimDate' || sortField === 'updatedAt' || sortField === 'createdAt') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (typeof aVal === 'string') {
      aVal = aVal?.toLowerCase() ?? '';
      bVal = bVal?.toLowerCase() ?? '';
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const getAddress = (c) => {
    const p = c.property || c;
    return [p.streetAddress, p.city, p.stateRegion, p.postalCode].filter(Boolean).join(', ') || '—';
  };

  // Click-to-copy the full address — same behavior as the property listing.
  const copyAddress = (addr) => {
    if (!addr || addr === '—') return;
    navigator.clipboard?.writeText(addr).then(
      () => toast.success('Address copied'),
      () => toast.error('Failed to copy address'),
    );
  };

  const getPropertyTitle = (c) => c.property?.title || c.propertyTitle || (c.propertyId ? `Property ${c.propertyId}` : '—');

  const getClaimedBy = (c) => {
    const name = c.clientName || c.claimedByName || c.userName || c.user?.name ||
      [c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ');
    return name || c.clientEmail || c.claimedByEmail || c.userEmail || c.user?.email || '—';
  };

  const getClaimedByEmail = (c) =>
    c.clientEmail || c.claimedByEmail || c.userEmail || c.user?.email || '';

  console.log('Claims data:', claims);

  return (
    <div className="p-4 md:p-8">
    
          <div className="mb-6">
        <h1 className="text-1xl md:text-1xl font-bold text-text-primary">
        Claim Properties
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
        Approve, reject, and manage submitted property claims.
        </p>
      </div>


	

      {/* Filters */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Search by property, claimant..."
            value={filters.search}
            onChange={(e) => { setFilters((prev) => ({ ...prev, search: e.target.value })); setPage(1); }}
          />
          <Select
            value={filters.status}
            onChange={(e) => { setFilters((prev) => ({ ...prev, status: e.target.value })); setPage(1); }}
            options={STATUS_FILTERS}
            showPlaceholder={false}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary">
            Showing {filtered.length === 0 ? 0 : Math.min((page - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}{' '}
            {filtered.length === 1 ? 'claim' : 'claims'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setFilters({ search: '', status: 'All' }); setSortField('claimDate'); setSortDirection('desc'); setPage(1); }}
            className="px-3 py-2 leading-none"
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="table-card bg-surface border border-border-subtle rounded-xl shadow-sm">
        {isLoading ? (
          <Loader />
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            Failed to load claim properties. Please try again.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No claim properties found matching your filters.
          </div>
        ) : (
          <div className="relative">
            <div className="overflow-visible relative">
              <table className="w-full table-auto relative">
                <thead className="bg-surface border-b">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase whitespace-nowrap">View Listing</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase">Full Address</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase whitespace-nowrap">Bed / Bath</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase">Price</th>
                    <SortableHeader label="Client Email" field="clientEmail" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Claim Date" field="claimDate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="whitespace-nowrap" />
                    <SortableHeader label="Status" field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="bg-surface" />
                  </tr>
                </thead>

                <tbody className="divide-y property-table">
                  {paginated.map((claim) => {
                    const claimStatus = claim.status || 'pending';
                    const showApprove = canApprove && claimStatus !== 'approved';
                    const showReject = canReject && claimStatus !== 'rejected';
                    const showPending = (canApprove || canReject) && claimStatus !== 'pending';
                    const canDelete = canApprove || canReject;
                    const hasMenu = showApprove || showReject || showPending || canDelete;
                    const dealId = claim.propertyId || claim.dealId || claim.property?.id;
                    const property = claim.property || {};
                    const statusCls = STATUS_BADGE[claimStatus] || 'bg-gray-100 text-gray-600 border border-gray-200';

                    return (
                    <tr key={claim.id} className="hover:bg-app">
                      {/* View Listing */}
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          disabled={!dealId}
                          onClick={() => dealId && navigate(`/deal-details/${dealId}`, { state: { from: '/claim-properties' } })}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          View Listing
                        </button>
                      </td>

                      {/* Full Address — click to copy (same as the property listing) */}
                      <td className="px-3 py-3 text-sm text-text-primary align-top">
                        {(() => {
                          const addr = getAddress(claim);
                          return addr && addr !== '—' ? (
                            <button
                              type="button"
                              onClick={() => copyAddress(addr)}
                              title="Click to copy address"
                              className="group inline-flex items-start gap-1.5 text-left text-accent hover:underline cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>{addr}</span>
                            </button>
                          ) : '—';
                        })()}
                      </td>

                      {/* Bed / Bath */}
                      <td className="px-3 py-3 text-sm text-text-primary whitespace-nowrap align-top">
                        {(property.bedrooms || property.bathrooms)
                          ? `${property.bedrooms || 0} Bed / ${property.bathrooms || 0} Bath`
                          : '—'}
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3 text-sm font-bold text-text-primary whitespace-nowrap align-top">
                        ${formatPrice(Number(property.price) || 0)}
                      </td>

                      {/* Client Email */}
                      <td className="px-3 py-3 text-sm text-text-secondary break-all align-top">
                        {claim.clientEmail || '—'}
                      </td>

                      {/* Claim Date */}
                      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap align-top">
                        {claim.claimDate ? new Date(claim.claimDate).toLocaleDateString() : '—'}
                      </td>

                      {/* Status — clickable badge opens the status/delete menu (like /admin/properties) */}
                      <td className="px-3 py-3 bg-surface align-top">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasMenu) return;
                              if (openMenuId === claim.id) {
                                setOpenMenuId(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenMenuId(claim.id);
                              }
                            }}
                            disabled={!hasMenu}
                            title={hasMenu ? 'Change status' : undefined}
                            className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap capitalize transition ${hasMenu ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'} ${statusCls}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                            {STATUS_LABEL[claimStatus] || claimStatus}
                            {hasMenu && (
                              <svg className="w-3 h-3 opacity-60" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          {openMenuId === claim.id && (
                            <div
                              style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right, zIndex: 9999 }}
                              className="w-40 bg-white border border-border-subtle rounded-lg shadow-lg py-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {showPending && (
                                <button
                                  onClick={() => { setOpenMenuId(null); pendingMutation.mutate({ id: claim.id }); }}
                                  className="w-full text-left px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  Pending
                                </button>
                              )}
                              {showApprove && (
                                <button
                                  onClick={() => { setOpenMenuId(null); setApproveTarget(claim); setApproveNotes(''); }}
                                  className="w-full text-left px-3 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors"
                                >
                                  Approve
                                </button>
                              )}
                              {showReject && (
                                <button
                                  onClick={() => { setOpenMenuId(null); setRejectTarget(claim); setRejectReason(''); }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  Reject
                                </button>
                              )}
                              {canDelete && (
                                <>
                                  {(showPending || showApprove || showReject) && (
                                    <div className="my-1 border-t border-border-subtle" />
                                  )}
                                  <button
                                    onClick={() => { setOpenMenuId(null); setDeleteTarget(claim); }}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    Delete Claim
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination currentPage={page} totalItems={filtered.length} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveTarget && (
        <Modal
          isOpen={!!approveTarget}
          onClose={() => { setApproveTarget(null); setApproveNotes(''); }}
          title="Approve Claim"
        >
          <div className="space-y-4">
            <p className="text-base text-text-primary">
              Are you sure you want to <strong>approve</strong> this claim?
            </p>
            <div className="border border-border-subtle rounded-lg p-4 space-y-2 bg-app">
              <p className="text-sm text-text-primary">
                <span className="font-semibold">Property:</span> {getPropertyTitle(approveTarget)}
              </p>
              <p className="text-sm text-text-primary">
                <span className="font-semibold">Claimed By:</span> {getClaimedBy(approveTarget)}
              </p>
              {getClaimedByEmail(approveTarget) && getClaimedByEmail(approveTarget) !== getClaimedBy(approveTarget) && (
                <p className="text-sm text-text-primary">
                  <span className="font-semibold">Email:</span> {getClaimedByEmail(approveTarget)}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setApproveTarget(null); setApproveNotes(''); }}>
                Cancel
              </Button>
              <button
                onClick={() => approveMutation.mutate({ id: approveTarget.id, notes: '' })}
                disabled={approveMutation.isPending}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve Claim'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <Modal
          isOpen={!!rejectTarget}
          onClose={() => { setRejectTarget(null); setRejectReason(''); }}
          title="Reject Claim"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              You are about to reject the claim for{' '}
              <span className="font-medium text-text-primary">{getPropertyTitle(rejectTarget)}</span>{' '}
              by <span className="font-medium text-text-primary">{getClaimedBy(rejectTarget)}</span>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => rejectMutation.mutate({ id: rejectTarget.id, reason: '' })}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Claim"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              This permanently deletes the claim for{' '}
              <span className="font-medium text-text-primary">{getPropertyTitle(deleteTarget)}</span>{' '}
              and clears the claim from the property (it will no longer show as claimed). This can't be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate({ id: deleteTarget.id })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Claim'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ClaimProperties;

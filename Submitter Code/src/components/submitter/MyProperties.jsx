import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dealsAPI } from '../../api/deals';
import { useAuth } from '../../contexts/AuthContext';
import logoDarkBlue from '../../assets/icons/logo-scholarship-house/logo-dark-blue.png';
import Button from '../Button';
import Loader from '../Loader';
import Input from '../Input';
import Select from '../Select';
import DateInput from '../DateInput';
import Modal from '../Modal';
import NotificationModal from '../NotificationModal';
import Textarea from '../Textarea';
import FileUpload from '../FileUpload';
import { normalizeMediaArray } from '../../utils/uploadFiles';
import { formatNumber, unformatNumber, formatPhoneDisplay } from '../../utils/format';
import { deriveTurnkey } from '../../utils/turnkey';
import { validateDealForm } from '../../utils/validateDealForm';

const fieldToLabel = (field) =>
    field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/_/g, ' ');

const CATEGORIES = [
    { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
    { value: 'CONDO', label: 'Condo' },
    { value: 'TOWNHOUSE', label: 'Town House' },
    { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
    { value: 'UNIQUE_PROPERTY', label: 'Unique Property (Treehouses, Castles, Yurts, Etc.)' },
];

const VACATION_RENTAL_MARKETS = [
    { value: 'BEACH', label: 'Beach Destinations' },
    { value: 'MOUNTAIN', label: 'Mountain Destinations' },
    { value: 'URBAN', label: 'Cities / Urban Destinations' },
    { value: 'LAKE', label: 'Lake Destinations' },
    { value: 'NATURE_PARKS', label: 'Nature / State & National Parks' },
    { value: 'THEME_PARKS', label: 'Theme Parks' },
    { value: 'COLLEGE_TOWN', label: 'College Towns' },
    { value: 'OFF_BEATEN_PATH', label: 'Off The Beaten Path' },
];

const TRAVEL_MOTIVATIONS = [
    'Conventions & Conferences', 'Exhibitions & Trade Shows', 'Medical Facilities',
    'College Activities', 'Sporting Events', 'Theme Parks', 'Relax & Unwind',
    'Sportsman Destinations – Fishing & Hunting',
    'Outdoor Activities – Hiking, Biking, Rafting, Skiing, Boating',
    'State & National Park Visits', 'Unplug & Disconnect', 'Experience a Unique Culture',
    'Romantic Getaway', 'Historic Districts & Attractions',
    'Bleisure – Business & Leisure Travel', 'Food & Wine Tasting', 'Art & Cultural Experience',
];

const SUBMITTER_RELATIONSHIP_OPTIONS = [
    { value: 'TEAM_MEMBER', label: 'Team Member' },
    { value: 'REALTOR_LISTING_OWNER', label: 'Realtor – Listing Owner' },
    { value: 'REALTOR_NOT_LISTING_OWNER', label: 'Realtor – Not Listing Owner' },
    { value: 'WHOLESALER_HOLDS_CONTRACT', label: 'Wholesaler – Holds Contract' },
    { value: 'WHOLESALER_NO_CONTRACT', label: 'Wholesaler – No Contract' },
    { value: 'REAL_ESTATE_PROFESSIONAL', label: 'Real Estate Professional' },
    { value: 'BIRDDOGGER', label: 'Bird Dogger' },
];

const TURNKEY_OPTIONS = [
    { value: 'TURNKEY_OPERATING', label: 'Turnkey and Currently Operating As a Short-Term Rental.' },
    { value: 'FURNISHED_NOT_OPERATING', label: 'Fully Furnished but not Currently Operating As a Short-Term Rental.' },
    { value: 'PARTIALLY_FURNISHED', label: 'Partially Furnished but not Currently Operating As a Short-Term Rental.' },
    { value: 'NOT_FURNISHED', label: 'Not Furnished or Currently Operating as a Short-Term Rental.' },
];

const FINANCING_OPTIONS = [
    { value: 'traditional', label: 'Traditional' },
    { value: 'subject-to', label: 'Subject-To' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'seller', label: 'Seller Financing' },
    { value: 'cash', label: 'Cash' },
];

const generateDealTitle = ({ bedrooms, bathrooms, city, stateRegion }) => {
    if (!bedrooms || !bathrooms || !city || !stateRegion) return '';
    return `${bedrooms} Bedroom, ${bathrooms} Bathroom in ${city}, ${stateRegion}`;
};

const getUserTypeLabel = (type) => {
    if (!type) return '';
    const map = {
        admin: 'Admin', submitter: 'Submitter', validator: 'Validator',
        realtor: 'Realtor', wholesaler: 'Wholesaler', birddogger: 'Bird Dogger',
        team_member: 'Team Member', client: 'Client',
        real_estate_professional: 'Real Estate Professional',
    };
    return map[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
};

const CheckboxGroup = ({ label, options, values = [], onChange }) => {
    const toggle = (value) => {
        onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
    };
    return (
        <div>
            <div className="font-semibold text-text-primary mb-2">{label}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {options.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={values.includes(value)}
                            onChange={() => toggle(value)}
                            className="w-4 h-4 rounded"
                        />
                        <span>{label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

const ITEMS_PER_PAGE = 10;

// Only 'published' and 'approved' deals are considered Active (visible/live).
const ACTIVE_STATUSES = new Set(['published', 'approved']);

const isActive = (status) => ACTIVE_STATUSES.has(String(status || '').toLowerCase());

const getLastUpdated = (deal) =>
    deal.updatedAt || deal.publishedAt || deal.submittedAt || deal.createdAt || null;

const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const StatusBadge = ({ status }) => {
    const active = isActive(status);
    return (<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${active ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`} title={`Raw status: ${status || 'unknown'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />{active ? 'Active' : 'Inactive'}</span>);
};

const MyProperties = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [editErrors, setEditErrors] = useState({});
    const editErrorRefs = useRef({});
    const [notification, setNotification] = useState({ open: false, type: 'info', title: '', message: '' });

    const { data: deals = [], isLoading, error, } = useQuery({
        queryKey: ['myProperties', user?.email],
        queryFn: dealsAPI.getMyDeals,
        enabled: !!user?.email,
        staleTime: 0,
    });

    const deleteMutation = useMutation({
        mutationFn: dealsAPI.unsubmitDeal,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myProperties'] });
            setPendingDelete(null);
            setNotification({
                open: true,
                type: 'success',
                title: 'Property Deleted',
                message: 'The property has been removed from your submissions.',
            });
        },
        onError: (err) => {
            setPendingDelete(null);
            setNotification({
                open: true,
                type: 'error',
                title: 'Delete Failed',
                message:
                    err?.response?.data?.message ||
                    'Could not delete this property. Published or approved properties must be removed by an admin.',
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ dealId, updates }) => dealsAPI.updateMyDeal(dealId, updates),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['myProperties'] });
            setEditing(null);
            setEditForm(null);
            setEditErrors({});
            setNotification({
                open: true,
                type: 'success',
                title: 'Property Updated',
                message: 'Your changes have been saved.',
            });
        },
        onError: (err) => {
            setNotification({
                open: true,
                type: 'error',
                title: 'Update Failed',
                message:
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    'Could not update this property. Please try again.',
            });
        },
    });

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const list = term
            ? deals.filter(
                (d) =>
                    (d.title || '').toLowerCase().includes(term) ||
                    (d.status || '').toLowerCase().includes(term)
            )
            : deals;
        return [...list].sort(
            (a, b) => new Date(getLastUpdated(b) || 0) - new Date(getLastUpdated(a) || 0)
        );
    }, [deals, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const page = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const canDelete = (deal) => String(deal.status || '').toLowerCase() === 'pending';

    const handleEdit = (deal) => {
        const status = String(deal.status || '').toLowerCase();
        if (status === 'published' || status === 'sold' || status === 'approved') {
            setNotification({
                open: true,
                type: 'info',
                title: 'Editing Unavailable',
                message:
                    'Approved or published properties cannot be edited directly. Contact an admin to request changes.',
            });
            return;
        }
        setEditErrors({});
        setEditing(deal);
        setEditForm({
            ...deal,
            status: status || 'pending',
            vacationRentalMarkets: Array.isArray(deal.vacationRentalMarkets) ? deal.vacationRentalMarkets : [],
            travelMotivations: Array.isArray(deal.travelMotivations) ? deal.travelMotivations : [],
            specialTags: Array.isArray(deal.specialTags) ? deal.specialTags : [],
            interiorImages: deal.interiorImages || [],
            exteriorImages: deal.exteriorImages || [],
            additionalImages: deal.additionalImages || [],
            videos: deal.videos || [],
        });
    };

    useEffect(() => {
        if (!editForm) return;
        const generatedTitle = generateDealTitle({
            bedrooms: editForm.bedrooms,
            bathrooms: editForm.bathrooms,
            city: editForm.city,
            stateRegion: editForm.stateRegion,
        });
        if (generatedTitle && generatedTitle !== editForm.title) {
            setEditForm((f) => ({ ...f, title: generatedTitle }));
        }
    }, [editForm?.bedrooms, editForm?.bathrooms, editForm?.city, editForm?.stateRegion]);

    const closeEdit = () => {
        if (updateMutation.isPending) return;
        setEditing(null);
        setEditForm(null);
        setEditErrors({});
    };

    const normalizeForSave = (deal) => {
        const normalizeEmpty = (v) => (v === '' || v === undefined ? null : v);
        const stripNumber = (v) => (typeof v === 'string' ? v.replace(/[^0-9.-]/g, '') : v);

        const normalized = {};
        Object.keys(deal).forEach((key) => {
            normalized[key] = normalizeEmpty(deal[key]);
        });

        return {
            ...normalized,
            price: stripNumber(deal.price),
            hoaMonthlyFee: stripNumber(deal.hoaMonthlyFee),
            emd: stripNumber(deal.emd),
            downPayment: stripNumber(deal.downPayment),
            squareFootage: stripNumber(deal.squareFootage),
            yearBuilt: stripNumber(deal.yearBuilt),
            bedrooms: stripNumber(deal.bedrooms),
            bathrooms: stripNumber(deal.bathrooms),
            subjLoanBalance: stripNumber(deal.subjLoanBalance),
            subjInterestRate: stripNumber(deal.subjInterestRate),
            subjMonthlyPrincipal: stripNumber(deal.subjMonthlyPrincipal),
            subjMonthlyInterest: stripNumber(deal.subjMonthlyInterest),
            subjMonthlyTaxesInsurance: stripNumber(deal.subjMonthlyTaxesInsurance),
            sellerLoanAmount: stripNumber(deal.sellerLoanAmount),
            sellerInterestRate: stripNumber(deal.sellerInterestRate),
            sellerMonthlyPayment: stripNumber(deal.sellerMonthlyPayment),
            totalMonthlyPayment: stripNumber(deal.totalMonthlyPayment),
            expectedCloseDate: normalizeEmpty(deal.expectedCloseDate),
            subjLoanMaturity: normalizeEmpty(deal.subjLoanMaturity),
            sellerLoanMaturity: normalizeEmpty(deal.sellerLoanMaturity),
            expiry_date: normalizeEmpty(deal.expiry_date),
        };
    };

    const validateMyEdit = () => {
        const { errors, firstErrorField } = validateDealForm(editForm, {
            requireMedia: true,
            requireRequiredFields: true,
        });
        setEditErrors(errors);
        return { firstErrorField, errors };
    };

    const handleEditSave = async () => {
        if (!editing || !editForm) return;

        const { firstErrorField, errors } = validateMyEdit();
        if (firstErrorField) {
            const errorMessages = Object.entries(errors)
                .slice(0, 5)
                .map(([field, msg]) => `${fieldToLabel(field)}: ${msg}`)
                .join('\n• ');
            const extraCount = Object.keys(errors).length - 5;
            const suffix = extraCount > 0 ? `\n...and ${extraCount} more` : '';
            setNotification({
                open: true,
                type: 'warning',
                title: 'Validation Error',
                message: `• ${errorMessages}${suffix}`,
            });
            const ref = editErrorRefs.current[firstErrorField];
            ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            ref?.focus?.();
            return;
        }

        const {
            id, submittedAt, publishedAt, createdAt, updatedAt,
            submitter, submitterEmail, submitterName, submitterPhone, submitterUserType,
            ...editable
        } = editForm;



        const normalizedUpdates = normalizeForSave({
            ...editable,
            title: editForm.title?.trim(),
            turnkey: deriveTurnkey(editable.turnkeyFurnished),
            interiorImages: await normalizeMediaArray(editable.interiorImages || []),
            exteriorImages: await normalizeMediaArray(editable.exteriorImages || []),
            additionalImages: await normalizeMediaArray(editable.additionalImages || []),
            videos: await normalizeMediaArray(editable.videos || []),
        });

        updateMutation.mutate({ dealId: id, updates: normalizedUpdates });
    };

    console.log('editForm : ',editForm)

    return (
        <div className="bg-app min-h-screen">
            <div className="mb-2">
                <div className="bg-surface p-4 mb-4 pt-10 pb-10">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1">
                        <div />
                        <div className="flex items-center justify-center gap-3">
                            <img src={logoDarkBlue} alt="Scholarship House" className="h-14 w-auto opacity-80" />
                            <h1 className="text-3xl md:text-4xl font-bold text-primary">My Properties</h1>
                        </div>
                        <div />
                    </div>
                    <p className="text-center text-text-secondary mb-2">Properties you have submitted</p>
                    <div className="h-1 w-20 bg-accent rounded-full mx-auto" />
                </div>
            </div>

            <div className="container mx-auto pt-2 pb-8 px-4 lg:px-4">
                <div className="bg-surface border border-border-subtle rounded-xl shadow-sm">
                    <div className="p-4 border-b border-border-subtle flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="text-sm text-text-secondary">
                            Showing {paginated.length} of {filtered.length} propert
                            {filtered.length !== 1 ? 'ies' : 'y'}
                        </div>
                        <div className="w-full md:w-72">
                            <Input
                                placeholder="Search by name or status..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12">
                            <Loader />
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center text-text-secondary">
                            Could not load your properties. Please try again.
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center text-text-secondary">
                            {deals.length === 0
                                ? 'You have not submitted any properties yet.'
                                : 'No properties match your search.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-app border-b border-border-subtle">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                            Property Name
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                            Last Updated
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {paginated.map((deal) => {
                                        const deletable = canDelete(deal);
                                        return (
                                            <tr key={deal.id} className="hover:bg-app transition-colors">
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() =>
                                                            navigate(`/deal-details/${deal.id}`, {
                                                                state: { from: '/my-properties' },
                                                            })
                                                        }
                                                        className="text-sm font-medium text-text-primary hover:text-primary text-left"
                                                    >
                                                        {deal.title || 'Untitled Property'}
                                                    </button>
                                                    {deal.streetAddress && (
                                                        <div className="text-xs text-text-secondary mt-0.5">
                                                            {deal.streetAddress}
                                                            {deal.city ? `, ${deal.city}` : ''}
                                                            {deal.stateRegion ? `, ${deal.stateRegion}` : ''}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={deal.status} />
                                                </td>
                                                <td className="px-4 py-3 text-sm text-text-secondary">
                                                    {formatDate(getLastUpdated(deal))}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="outline" onClick={() => handleEdit(deal)}>
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            disabled={!deletable || deleteMutation.isPending}
                                                            title={
                                                                deletable
                                                                    ? 'Delete this property'
                                                                    : 'Only pending properties can be deleted'
                                                            }
                                                            onClick={() => deletable && setPendingDelete(deal)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page === 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-text-secondary">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page === totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={!!pendingDelete}
                onClose={() => setPendingDelete(null)}
                title="Delete Property"
                size="sm"
            >
                {pendingDelete && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">
                            Are you sure you want to delete{' '}
                            <span className="font-medium text-text-primary">{pendingDelete.title}</span>? This
                            action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setPendingDelete(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(pendingDelete.id)}
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={!!editing && !!editForm}
                onClose={closeEdit}
                title="Edit Property"
                size="xl"
            >
                {editForm && (
                    <div className="space-y-4 max-h-[80vh] overflow-y-auto">
                        {/* Submitter Info (read-only) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Full Name" value={editForm?.submitter?.name || editForm?.submitterName || user?.name || ''} readOnly className="cursor-not-allowed bg-app" />
                            <Input label="Email" value={editForm?.submitter?.email || editForm?.submitterEmail || user?.email || ''} readOnly className="cursor-not-allowed bg-app" />
                            <Input label="Phone" value={formatPhoneDisplay(editForm?.submitter?.phone || editForm?.submitterPhone || user?.phone || '')} readOnly className="cursor-not-allowed bg-app" />
                            <Input label="User Type" value={getUserTypeLabel(editForm?.submitter?.userType || editForm?.submitterUserType || user?.userType) || ''} readOnly className="cursor-not-allowed bg-app" />
                            <Select
                                label="Submitter Relationship"
                                value={editForm.submitterRelationship || ''}
                                onChange={(e) => setEditForm((f) => ({ ...f, submitterRelationship: e.target.value }))}
                                options={SUBMITTER_RELATIONSHIP_OPTIONS}
                            />
                        </div>

                        {/* Address */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Street Address" value={editForm.streetAddress || ''} error={editErrors.streetAddress} ref={(el) => (editErrorRefs.current.streetAddress = el)} onChange={(e) => setEditForm((f) => ({ ...f, streetAddress: e.target.value }))} />
                            <Input label="Address Line 2" value={editForm.addressLine2 || ''} onChange={(e) => setEditForm((f) => ({ ...f, addressLine2: e.target.value }))} />
                            <Input label="City" value={editForm.city || ''} error={editErrors.city} ref={(el) => (editErrorRefs.current.city = el)} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
                            <Input label="State/Region/Province" value={editForm.stateRegion || ''} error={editErrors.stateRegion} ref={(el) => (editErrorRefs.current.stateRegion = el)} onChange={(e) => setEditForm((f) => ({ ...f, stateRegion: e.target.value }))} />
                            <Input label="Postal/Zip Code" value={editForm.postalCode || ''} error={editErrors.postalCode} ref={(el) => (editErrorRefs.current.postalCode = el)} onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))} />
                        </div>

                        {/* Property Basics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Category" value={editForm.category || ''} error={editErrors.category} ref={(el) => (editErrorRefs.current.category = el)} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} options={CATEGORIES} />
                            <Select
                                label="Turnkey/Furnished"
                                value={editForm.turnkeyFurnished || ''}
                                error={editErrors.turnkeyFurnished}
                                ref={(el) => (editErrorRefs.current.turnkeyFurnished = el)}
                                onChange={(e) => setEditForm((f) => ({ ...f, turnkeyFurnished: e.target.value }))}
                                options={TURNKEY_OPTIONS}
                            />
                            <Input label="Bedrooms" type="text" inputMode="numeric" value={formatNumber(editForm.bedrooms || '')} error={editErrors.bedrooms} ref={(el) => (editErrorRefs.current.bedrooms = el)} onChange={(e) => setEditForm((f) => ({ ...f, bedrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Bathrooms" type="text" inputMode="numeric" value={formatNumber(editForm.bathrooms || '')} error={editErrors.bathrooms} ref={(el) => (editErrorRefs.current.bathrooms = el)} onChange={(e) => setEditForm((f) => ({ ...f, bathrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Year Built" type="text" inputMode="numeric" value={editForm.yearBuilt || ''} error={editErrors.yearBuilt} ref={(el) => (editErrorRefs.current.yearBuilt = el)} onChange={(e) => setEditForm((f) => ({ ...f, yearBuilt: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Square Footage" type="text" inputMode="numeric" value={formatNumber(editForm.squareFootage || '')} error={editErrors.squareFootage} ref={(el) => (editErrorRefs.current.squareFootage = el)} onChange={(e) => setEditForm((f) => ({ ...f, squareFootage: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DateInput
                                label="Property Expiration Date"
                                name="expiry_date"
                                value={editForm.expiry_date ?? ''}
                                error={editErrors.expiry_date}
                                ref={(el) => (editErrorRefs.current.expiry_date = el)}
                                onChange={(e) => setEditForm((f) => ({ ...f, expiry_date: e.target.value }))}
                                placeholder="Select date"
                            />
                        </div>

                        <Input label="Title" value={editForm.title || ''} readOnly className="bg-app cursor-not-allowed" />
                        <Textarea label="Description" value={editForm.description || ''} error={editErrors.description} ref={(el) => (editErrorRefs.current.description = el)} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={4} />

                        {/* HOA */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="HOA"
                                value={editForm.isHOA ? 'YES' : 'NO'}
                                onChange={(e) => {
                                    const isHOA = e.target.value === 'YES';
                                    setEditForm((f) => ({ ...f, isHOA, hoaMonthlyFee: isHOA ? f.hoaMonthlyFee : null }));
                                }}
                                options={[{ value: 'NO', label: 'No' }, { value: 'YES', label: 'Yes' }]}
                            />
                            <Input label="HOA Monthly Fee" type="text" inputMode="numeric" value={formatNumber(editForm.hoaMonthlyFee || '')} error={editErrors.hoaMonthlyFee} ref={(el) => (editErrorRefs.current.hoaMonthlyFee = el)} disabled={!editForm.isHOA} className={!editForm.isHOA ? 'bg-app cursor-not-allowed' : ''} placeholder={editForm.isHOA ? '' : 'N/A'} onChange={(e) => setEditForm((f) => ({ ...f, hoaMonthlyFee: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                        </div>

                        {/* Price */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Price" type="text" inputMode="numeric" value={formatNumber(editForm.price || '')} error={editErrors.price} ref={(el) => (editErrorRefs.current.price = el)} onChange={(e) => setEditForm((f) => ({ ...f, price: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <label className="flex items-center gap-3 cursor-pointer mt-2">
                                <input type="checkbox" checked={!!editForm.discountPrice} onChange={(e) => setEditForm((f) => ({ ...f, discountPrice: e.target.checked }))} className="w-5 h-5 accent-accent" />
                                <span className="text-sm font-medium text-text-primary">Discount Price</span>
                            </label>
                        </div>

                        {/* Financing */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Financing Type" value={editForm.financingType || ''} error={editErrors.financingType} ref={(el) => (editErrorRefs.current.financingType = el)} onChange={(e) => setEditForm((f) => ({ ...f, financingType: e.target.value }))} options={FINANCING_OPTIONS} />
                            <Input label="EMD" type="text" inputMode="numeric" value={formatNumber(editForm.emd || '')} error={editErrors.emd} ref={(el) => (editErrorRefs.current.emd = el)} onChange={(e) => setEditForm((f) => ({ ...f, emd: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Down Payment" type="text" inputMode="numeric" value={formatNumber(editForm.downPayment || '')} error={editErrors.downPayment} ref={(el) => (editErrorRefs.current.downPayment = el)} onChange={(e) => setEditForm((f) => ({ ...f, downPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <DateInput label="Expected Close of Escrow" name="expectedCloseDate" value={editForm.expectedCloseDate ?? ''} error={editErrors.expectedCloseDate} ref={(el) => (editErrorRefs.current.expectedCloseDate = el)} onChange={(e) => setEditForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} placeholder="Select date" />
                        </div>

                        <Textarea label="Additional Financial Information" value={editForm.financialInfo || ''} error={editErrors.financialInfo} ref={(el) => (editErrorRefs.current.financialInfo = el)} onChange={(e) => setEditForm((f) => ({ ...f, financialInfo: e.target.value }))} rows={3} />

                        {/* Subject-to Loan Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Subject-to Loan Balance" type="text" inputMode="numeric" value={formatNumber(editForm.subjLoanBalance || '')} error={editErrors.subjLoanBalance} ref={(el) => (editErrorRefs.current.subjLoanBalance = el)} onChange={(e) => setEditForm((f) => ({ ...f, subjLoanBalance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Subject-to Interest Rate" type="text" inputMode="numeric" value={formatNumber(editForm.subjInterestRate || '')} error={editErrors.subjInterestRate} ref={(el) => (editErrorRefs.current.subjInterestRate = el)} onChange={(e) => setEditForm((f) => ({ ...f, subjInterestRate: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <DateInput label="Subject-to Loan Maturity" name="subjLoanMaturity" value={editForm.subjLoanMaturity ?? ''} error={editErrors.subjLoanMaturity} ref={(el) => (editErrorRefs.current.subjLoanMaturity = el)} onChange={(e) => setEditForm((f) => ({ ...f, subjLoanMaturity: e.target.value }))} placeholder="Select date" />
                            <Input label="Subject-to Monthly Principal" type="text" inputMode="numeric" value={formatNumber(editForm.subjMonthlyPrincipal || '')} error={editErrors.subjMonthlyPrincipal} ref={(el) => (editErrorRefs.current.subjMonthlyPrincipal = el)} onChange={(e) => setEditForm((f) => ({ ...f, subjMonthlyPrincipal: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Subject-to Monthly Interest" type="text" inputMode="numeric" value={formatNumber(editForm.subjMonthlyInterest || '')} error={editErrors.subjMonthlyInterest} ref={(el) => (editErrorRefs.current.subjMonthlyInterest = el)} onChange={(e) => setEditForm((f) => ({ ...f, subjMonthlyInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Subject-to Monthly Taxes & Insurance" type="text" inputMode="numeric" value={formatNumber(editForm.subjMonthlyTaxesInsurance || '')} error={editErrors.subjMonthlyTaxesInsurance} ref={(el) => (editErrorRefs.current.subjMonthlyTaxesInsurance = el)} onChange={(e) => setEditForm((f) => ({ ...f, subjMonthlyTaxesInsurance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                        </div>

                        {/* Seller Financing */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Seller Loan Amount" type="text" inputMode="numeric" value={formatNumber(editForm.sellerLoanAmount || '')} error={editErrors.sellerLoanAmount} ref={(el) => (editErrorRefs.current.sellerLoanAmount = el)} onChange={(e) => setEditForm((f) => ({ ...f, sellerLoanAmount: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Seller Interest Rate" type="text" inputMode="numeric" value={formatNumber(editForm.sellerInterestRate || '')} error={editErrors.sellerInterestRate} ref={(el) => (editErrorRefs.current.sellerInterestRate = el)} onChange={(e) => setEditForm((f) => ({ ...f, sellerInterestRate: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <DateInput label="Seller Loan Maturity" name="sellerLoanMaturity" value={editForm.sellerLoanMaturity ?? ''} error={editErrors.sellerLoanMaturity} ref={(el) => (editErrorRefs.current.sellerLoanMaturity = el)} onChange={(e) => setEditForm((f) => ({ ...f, sellerLoanMaturity: e.target.value }))} placeholder="Select date" />
                            <Input label="Seller Monthly Payment" type="text" inputMode="numeric" value={formatNumber(editForm.sellerMonthlyPayment || '')} error={editErrors.sellerMonthlyPayment} ref={(el) => (editErrorRefs.current.sellerMonthlyPayment = el)} onChange={(e) => setEditForm((f) => ({ ...f, sellerMonthlyPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            <Input label="Total Monthly Payment" type="text" inputMode="numeric" value={formatNumber(editForm.totalMonthlyPayment || '')} error={editErrors.totalMonthlyPayment} ref={(el) => (editErrorRefs.current.totalMonthlyPayment = el)} onChange={(e) => setEditForm((f) => ({ ...f, totalMonthlyPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                        </div>

                        {/* STR Data */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="STR Zoning" value={editForm.strZoning || ''} error={editErrors.strZoning} ref={(el) => (editErrorRefs.current.strZoning = el)} onChange={(e) => setEditForm((f) => ({ ...f, strZoning: e.target.value }))} options={[{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }, { value: 'UNSURE', label: 'Unsure' }]} />
                            <Select label="STR Confidence" value={editForm.strConfidence || ''} error={editErrors.strConfidence} ref={(el) => (editErrorRefs.current.strConfidence = el)} onChange={(e) => setEditForm((f) => ({ ...f, strConfidence: e.target.value }))} options={[{ value: 'FIRST_HAND', label: 'First Hand information' }, { value: 'AIRDNA', label: 'Based on AirDNA' }, { value: 'DIRECTIONAL_ONLY', label: 'Directional only / not fully confident' }]} />
                            <Input label="STR Listing Link" value={editForm.strListingLink || ''} onChange={(e) => setEditForm((f) => ({ ...f, strListingLink: e.target.value }))} />
                            <Input label="STR Data Sheets Link" value={editForm.strDataSheetsLink || ''} onChange={(e) => setEditForm((f) => ({ ...f, strDataSheetsLink: e.target.value }))} />
                        </div>

                        <CheckboxGroup
                            label="Vacation Rental Markets"
                            options={VACATION_RENTAL_MARKETS}
                            values={editForm.vacationRentalMarkets || []}
                            onChange={(vals) => setEditForm((f) => ({ ...f, vacationRentalMarkets: vals }))}
                        />

                        {/* Travel Motivations */}
                        <div className="mb-6">
                            <label className="block text-base font-semibold text-text-primary mb-2">Why Do People Travel to This Destination?</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {TRAVEL_MOTIVATIONS.map((reason) => (
                                    <label key={reason} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={editForm.travelMotivations?.includes(reason) || false}
                                            onChange={(e) => setEditForm((f) => ({
                                                ...f,
                                                travelMotivations: e.target.checked
                                                    ? [...(f.travelMotivations || []), reason]
                                                    : (f.travelMotivations || []).filter((r) => r !== reason),
                                            }))}
                                        />
                                        <span className="text-sm text-text-primary">{reason}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Textarea label={<span className="text-base font-semibold">What Do Rental Guests Want Most in This Area?</span>} value={editForm.guestDemandInsights || ''} onChange={(e) => setEditForm((f) => ({ ...f, guestDemandInsights: e.target.value }))} rows={4} placeholder="Insights into guest expectations, amenities, or experiences..." />
                            <Textarea label={<span className="text-base font-semibold">How Can We Add Value to This Property to Increase Income?</span>} value={editForm.valueAddOpportunities || ''} onChange={(e) => setEditForm((f) => ({ ...f, valueAddOpportunities: e.target.value }))} rows={4} placeholder="Examples: pool, hot tub, bikes, beach gear, game tables, etc." />
                            <Textarea label={<span className="text-base font-semibold">Recommended Property Managers, Contractors, or Cleaning Companies</span>} value={editForm.localContacts || ''} onChange={(e) => setEditForm((f) => ({ ...f, localContacts: e.target.value }))} rows={4} placeholder="List any trusted local contacts buyers could use..." />
                        </div>

                        {/* Media */}
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold text-text-primary mb-4">Property Photos and Videos</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FileUpload label="Interior Photos" accept="image/*" multiple value={editForm.interiorImages || []} onChange={(urls) => setEditForm((f) => ({ ...f, interiorImages: urls }))} />
                                <FileUpload label="Exterior Photos" accept="image/*" multiple value={editForm.exteriorImages || []} onChange={(urls) => setEditForm((f) => ({ ...f, exteriorImages: urls }))} />
                                <div className="col-span-full">
                                    <FileUpload label="Additional Photos" accept="image/*" multiple value={editForm.additionalImages || []} onChange={(urls) => setEditForm((f) => ({ ...f, additionalImages: urls }))} />
                                </div>
                            </div>
                            <div className="mt-6">
                                <FileUpload label="Videos" accept="video/*" multiple value={editForm.videos || []} onChange={(urls) => setEditForm((f) => ({ ...f, videos: urls }))} />
                            </div>
                        </div>

                        <Input label="Special Tags (comma separated)" value={(editForm.specialTags || []).join(', ')} onChange={(e) => setEditForm((f) => ({ ...f, specialTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} />
                        <Textarea label="Additional Info" value={editForm.additionalInfo || ''} onChange={(e) => setEditForm((f) => ({ ...f, additionalInfo: e.target.value }))} rows={3} />

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={editForm.status}
                                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light"
                            >
                                <option value="pending">Pending</option>
                                <option value="draft">Draft</option>
                            </select>
                        </div>

                        <div className="mt-6 border-t border-border-subtle pt-6 flex justify-end gap-3">
                            <Button variant="outline" onClick={closeEdit} disabled={updateMutation.isPending}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleEditSave}
                                loading={updateMutation.isPending}
                                disabled={updateMutation.isPending}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <NotificationModal
                isOpen={notification.open}
                onClose={() => setNotification((n) => ({ ...n, open: false }))}
                type={notification.type}
                title={notification.title}
                message={notification.message}
            />
        </div>
    );
};

export default MyProperties;

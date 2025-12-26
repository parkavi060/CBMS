import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { allocationAPI, departmentsAPI, budgetHeadsAPI, reportAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import { ArrowLeft, Save, X, IndianRupee, Search } from 'lucide-react';
import './AllocationForm.css';

const AllocationForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const isEditMode = !!id;

    const queryParams = new URLSearchParams(location.search);
    const preselectProposalId = queryParams.get('proposalId');
    const preselectDeptId = queryParams.get('deptId');
    const preselectFY = queryParams.get('fy');

    const [departments, setDepartments] = useState([]);
    const [budgetHeads, setBudgetHeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditMode);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        department: '',
        budgetHead: '',
        allocatedAmount: '',
        financialYear: '2024-2025',
        remarks: ''
    });

    const [proposals, setProposals] = useState([]);
    const [fetchingProposals, setFetchingProposals] = useState(false);
    const [showProposalPicker, setShowProposalPicker] = useState(false);

    const fetchApprovedProposals = async () => {
        if (!formData.department || !formData.financialYear) {
            setError('Please select department and financial year first');
            return;
        }

        try {
            setFetchingProposals(true);
            const response = await reportAPI.getBudgetProposalReport({
                department: formData.department,
                financialYear: formData.financialYear,
                status: 'approved'
            });

            const approvedProposals = response.data.data.proposals;
            // Flatten proposal items
            const items = approvedProposals.flatMap(p =>
                p.proposalItems.map(item => ({
                    ...item,
                    proposalId: p._id,
                    deptName: p.department.name
                }))
            );

            setProposals(items);
            setShowProposalPicker(true);
            if (items.length === 0) {
                setError('No approved proposals found for the selected criteria');
            }
        } catch (err) {
            console.error('Error fetching approved proposals:', err);
            setError('Failed to fetch approved proposals');
        } finally {
            setFetchingProposals(false);
        }
    };

    const handleSelectProposal = (item) => {
        setFormData(prev => ({
            ...prev,
            budgetHead: item.budgetHead._id || item.budgetHead,
            allocatedAmount: item.proposedAmount.toString(),
            remarks: `Based on approved budget proposal item. Justification: ${item.justification}`
        }));
        setShowProposalPicker(false);
    };

    useEffect(() => {
        fetchInitialData();
        if (isEditMode) {
            fetchAllocation();
        } else if (preselectDeptId && preselectFY) {
            setFormData(prev => ({
                ...prev,
                department: preselectDeptId,
                financialYear: preselectFY
            }));
        }
    }, [id, isEditMode, preselectDeptId, preselectFY]);

    useEffect(() => {
        if (!isEditMode && preselectProposalId && formData.department === preselectDeptId && formData.financialYear === preselectFY) {
            fetchApprovedProposals();
        }
    }, [formData.department, formData.financialYear, isEditMode, preselectProposalId, preselectDeptId, preselectFY]);

    const fetchInitialData = async () => {
        try {
            const deptResponse = await departmentsAPI.getDepartments();
            setDepartments(deptResponse.data.data.departments);

            // Fetch all budget heads initially (will be filtered by department selection)
            const headResponse = await budgetHeadsAPI.getBudgetHeads();
            setBudgetHeads(headResponse.data.data.budgetHeads);
        } catch (err) {
            console.error('Error fetching initial data:', err);
            setError('Failed to fetch departments or budget heads');
        }
    };

    // Fetch budget heads when department changes
    useEffect(() => {
        const fetchBudgetHeadsForDepartment = async () => {
            if (formData.department && !isEditMode) {
                try {
                    const headResponse = await budgetHeadsAPI.getBudgetHeads({ department: formData.department });
                    setBudgetHeads(headResponse.data.data.budgetHeads);
                } catch (err) {
                    console.error('Error fetching budget heads:', err);
                }
            }
        };
        fetchBudgetHeadsForDepartment();
    }, [formData.department, isEditMode]);

    const fetchAllocation = async () => {
        try {
            setFetching(true);
            const response = await allocationAPI.getAllocationById(id);
            const allocation = response.data.data.allocation;
            setFormData({
                department: allocation.department?._id || allocation.department || '',
                budgetHead: allocation.budgetHead?._id || allocation.budgetHead || '',
                allocatedAmount: allocation.allocatedAmount.toString(),
                financialYear: allocation.financialYear,
                remarks: allocation.remarks || ''
            });
        } catch (err) {
            setError('Failed to fetch allocation data');
            console.error(err);
        } finally {
            setFetching(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Reset budget head when department changes (for new allocations only)
        if (name === 'department' && !isEditMode) {
            setFormData(prev => ({
                ...prev,
                budgetHead: ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            setLoading(true);
            if (isEditMode) {
                await allocationAPI.updateAllocation(id, formData);
            } else {
                await allocationAPI.createAllocation(formData);
            }
            navigate('/allocations');
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} allocation`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="allocation-form-loading">
                <div className="loading-spinner"></div>
                <p>Loading allocation data...</p>
            </div>
        );
    }

    return (
        <div className="add-allocation-container">
            <PageHeader
                title={isEditMode ? "Edit Allocation" : "Add New Allocation"}
                subtitle={isEditMode ? "Update budget allocation details" : "Allocate budget to a department and budget head"}
            >
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/allocations')}>
                    <ArrowLeft size={18} /> Back to Allocations
                </button>
            </PageHeader>

            <div className="add-allocation-card">
                <form onSubmit={handleSubmit} className="add-allocation-form">
                    {error && (
                        <div className="alert alert-error mb-4">
                            <X size={20} className="mr-2" onClick={() => setError(null)} style={{ cursor: 'pointer' }} />
                            {error}
                        </div>
                    )}

                    <div className="form-sections-grid">
                        <div className="form-section">
                            <h3 className="section-title">Allocation Details</h3>

                            <div className="form-group">
                                <label htmlFor="department">Department *</label>
                                <select
                                    id="department"
                                    name="department"
                                    value={formData.department}
                                    onChange={handleInputChange}
                                    required
                                    disabled={isEditMode}
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(dept => (
                                        <option key={dept._id} value={dept._id}>{dept.name}</option>
                                    ))}
                                </select>
                                {isEditMode && <small>Department cannot be changed after allocation</small>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="budgetHead">Budget Head *</label>
                                <select
                                    id="budgetHead"
                                    name="budgetHead"
                                    value={formData.budgetHead}
                                    onChange={handleInputChange}
                                    required
                                    disabled={isEditMode}
                                >
                                    <option value="">Select Budget Head</option>
                                    {budgetHeads.map(head => (
                                        <option key={head._id} value={head._id}>{head.name} ({head.code})</option>
                                    ))}
                                </select>
                                {isEditMode && <small>Budget head cannot be changed after allocation</small>}
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="section-title">Financial Information</h3>

                            <div className="form-group">
                                <div className="label-with-action">
                                    <label htmlFor="allocatedAmount">Allocated Amount *</label>
                                    {!isEditMode && (
                                        <button
                                            type="button"
                                            className="btn-link"
                                            onClick={fetchApprovedProposals}
                                            disabled={fetchingProposals || !formData.department || !formData.financialYear}
                                        >
                                            <Search size={14} /> {fetchingProposals ? 'Fetching...' : 'Fetch from Proposal'}
                                        </button>
                                    )}
                                </div>
                                <div className="amount-input-wrapper">
                                    <input
                                        type="number"
                                        id="allocatedAmount"
                                        name="allocatedAmount"
                                        value={formData.allocatedAmount}
                                        onChange={handleInputChange}
                                        required
                                        min="0"
                                        step="0.01"
                                        placeholder="Enter amount"
                                    />
                                    <IndianRupee size={16} className="lucide-indian-rupee" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="financialYear">Financial Year *</label>
                                <input
                                    type="text"
                                    id="financialYear"
                                    name="financialYear"
                                    value={formData.financialYear}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="e.g., 2024-2025"
                                    disabled={isEditMode}
                                />
                                {isEditMode && <small>Financial year cannot be changed after allocation</small>}
                            </div>
                        </div>

                        <div className="form-section full-width">
                            <h3 className="section-title">Additional Information</h3>
                            <div className="form-group">
                                <label htmlFor="remarks">Remarks</label>
                                <textarea
                                    id="remarks"
                                    name="remarks"
                                    value={formData.remarks}
                                    onChange={handleInputChange}
                                    placeholder="Enter any additional notes or remarks..."
                                    rows="4"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => navigate('/allocations')}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (
                                <>
                                    <Save size={18} className="mr-2" /> {isEditMode ? 'Update Allocation' : 'Create Allocation'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {showProposalPicker && (
                <div className="proposal-picker-modal">
                    <div className="proposal-picker-content">
                        <div className="proposal-picker-header">
                            <h3>Select Approved Proposal Item</h3>
                            <button className="close-btn" onClick={() => setShowProposalPicker(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="proposal-picker-body">
                            {proposals.length > 0 ? (
                                <div className="proposal-items-list">
                                    {proposals.map((item, index) => (
                                        <div
                                            key={index}
                                            className="proposal-item-card"
                                            onClick={() => handleSelectProposal(item)}
                                        >
                                            <div className="item-header">
                                                <span className="item-head">{item.budgetHead.name}</span>
                                                <span className="item-amount">₹{item.proposedAmount.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="item-details">
                                                <p><strong>Justification:</strong> {item.justification}</p>
                                                <p className="item-meta">Approved Proposal</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-items">No approved proposal items found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AllocationForm;

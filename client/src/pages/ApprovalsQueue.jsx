import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { expenditureAPI, budgetProposalAPI } from '../services/api';
import Tooltip from '../components/Tooltip/Tooltip';
import { Check, X, Search, FileText, DollarSign, ClipboardList } from 'lucide-react';
import './ApprovalsQueue.css';

const ApprovalsQueue = () => {
  const { user } = useAuth();
  const [approvalItems, setApprovalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'pending_approval' });

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const getPropStatus = () => {
        if (filters.status === 'pending_approval' || filters.status === 'pending' || filters.status === 'verified') {
          return 'submitted';
        }
        return filters.status;
      };

      const [expRes, propRes] = await Promise.all([
        expenditureAPI.getExpenditures(filters),
        budgetProposalAPI.getBudgetProposals({ ...filters, status: getPropStatus() })
      ]);

      const mappedExpenditures = expRes.data.data.expenditures.map(exp => ({
        ...exp,
        itemType: 'expenditure',
        reference: exp.billNumber,
        amount: exp.billAmount,
        department: exp.departmentName,
        head: exp.budgetHeadName,
        date: exp.billDate
      }));

      const mappedProposals = propRes.data.data.proposals.map(prop => ({
        ...prop,
        itemType: 'proposal',
        reference: `FY ${prop.financialYear}`,
        amount: prop.totalProposedAmount,
        department: prop.department?.name || 'N/A',
        head: 'Budget Proposal',
        date: prop.submittedDate || prop.createdAt
      }));

      const unified = [...mappedExpenditures, ...mappedProposals].sort((a, b) => new Date(b.date) - new Date(a.date));
      setApprovalItems(unified);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [filters]);

  const handleAction = (item, type) => {
    setSelectedItem(item);
    setActionType(type);
    setShowModal(true);
  };

  const processAction = async () => {
    try {
      if (actionType === 'reject' && !remarks.trim()) {
        alert('Remarks are mandatory for rejection. Please provide a reason.');
        return;
      }

      if (selectedItem.itemType === 'expenditure') {
        if (actionType === 'verify') {
          await expenditureAPI.verifyExpenditure(selectedItem._id, { remarks });
        } else if (actionType === 'approve') {
          await expenditureAPI.approveExpenditure(selectedItem._id, { remarks });
        } else {
          await expenditureAPI.rejectExpenditure(selectedItem._id, { remarks });
        }
      } else {
        // Handle Budget Proposal
        if (actionType === 'verify') {
          await budgetProposalAPI.verifyBudgetProposal(selectedItem._id, { remarks });
        } else if (actionType === 'approve') {
          await budgetProposalAPI.approveBudgetProposal(selectedItem._id, { notes: remarks });
        } else if (actionType === 'reject') {
          await budgetProposalAPI.rejectBudgetProposal(selectedItem._id, { rejectionReason: remarks });
        }
      }

      setShowModal(false);
      setRemarks('');
      fetchApprovals();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error processing action');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="approvals-queue-container">
      <div className="approvals-header">
        <h1 className="page-title">Approvals</h1>
        <div className="queue-stats">
          <div className="stat-badge pending">
            <span>Needs Attention: {approvalItems.length}</span>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} color="#9ca3af" />
            <input
              type="text"
              placeholder="Search by Bill Number or Department..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              style={{ border: 'none', outline: 'none', width: '100%' }}
            />
          </div>
        </div>
        <div className="filter-group" style={{ maxWidth: '200px' }}>
          <select
            className="form-select"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="pending_approval">Pending My Approval</option>
            <option value="pending">Submitted (Pending Verification)</option>
            <option value="verified">Verified (Pending Approval)</option>
            <option value="approved">Approved / Deduction Recorded</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="approvals-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reference</th>
              <th>Department / Content</th>
              <th>Details</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {approvalItems.map((item) => (
              <tr key={item._id}>
                <td>
                  <div className="item-type-tag" title={item.itemType === 'expenditure' ? 'Expenditure Bill' : 'Budget Proposal'}>
                    {item.itemType === 'expenditure' ? <DollarSign size={16} /> : <ClipboardList size={16} />}
                    <span style={{ fontSize: '10px' }}>{item.itemType.toUpperCase()}</span>
                  </div>
                </td>
                <td>
                  <strong>{item.reference}</strong>
                </td>
                <td>
                  <div className="department-info">
                    <span className="dept-name">{item.department}</span>
                    <span className="budget-head">{item.head}</span>
                  </div>
                </td>
                <td>{item.itemType === 'expenditure' ? item.partyName : `${item.proposalItems?.length || 0} Items`}</td>
                <td className="date-text">{new Date(item.date).toLocaleDateString('en-IN')}</td>
                <td className="amount-text">{formatCurrency(item.amount)}</td>
                <td>
                  <span className={`status-badge ${item.status}`}>
                    {item.status === 'submitted' ? 'pending' : item.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    {/* HOD Action: Verify or Reject (Both Types) */}
                    {user?.role === 'hod' &&
                      ((item.itemType === 'expenditure' && item.status === 'pending') ||
                        (item.itemType === 'proposal' && item.status === 'submitted')) && (
                        <>
                          <Tooltip text="Verify" position="top">
                            <button className="btn-icon approve" onClick={() => handleAction(item, 'verify')}>
                              <Check size={16} />
                            </button>
                          </Tooltip>
                          <Tooltip text="Reject" position="top">
                            <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                              <X size={16} />
                            </button>
                          </Tooltip>
                        </>
                      )}

                    {/* VP/Principal Action: Approve or Reject (Both Types) */}
                    {['vice_principal', 'principal'].includes(user?.role) &&
                      ((item.itemType === 'expenditure' && (item.status === 'verified' || item.status === 'pending')) ||
                        (item.itemType === 'proposal' && (item.status === 'verified' || item.status === 'submitted'))) && (
                        <>
                          <Tooltip text="Approve" position="top">
                            <button className="btn-icon approve" onClick={() => handleAction(item, 'approve')}>
                              <Check size={16} />
                            </button>
                          </Tooltip>
                          <Tooltip text="Reject" position="top">
                            <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                              <X size={16} />
                            </button>
                          </Tooltip>
                        </>
                      )}

                    {/* Office Action: Verify/Approve or Reject */}
                    {user?.role === 'office' && (
                      <>
                        {/* Expenditure Flow */}
                        {item.itemType === 'expenditure' && (
                          <>
                            {item.status === 'pending' && (
                              <Tooltip text="Verify" position="top">
                                <button className="btn-icon approve" onClick={() => handleAction(item, 'verify')}>
                                  <Check size={16} />
                                </button>
                              </Tooltip>
                            )}
                            {item.status === 'verified' && (
                              <Tooltip text="Approve (Deduct)" position="top">
                                <button className="btn-icon approve" onClick={() => handleAction(item, 'approve')}>
                                  <Check size={16} />
                                </button>
                              </Tooltip>
                            )}
                            {['pending', 'verified'].includes(item.status) && (
                              <Tooltip text="Reject" position="top">
                                <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                                  <X size={16} />
                                </button>
                              </Tooltip>
                            )}
                          </>
                        )}
                        {/* Proposal Flow */}
                        {item.itemType === 'proposal' && (
                          <>
                            {item.status === 'submitted' && (
                              <Tooltip text="Verify" position="top">
                                <button className="btn-icon approve" onClick={() => handleAction(item, 'verify')}>
                                  <Check size={16} />
                                </button>
                              </Tooltip>
                            )}
                            {item.status === 'verified' && (
                              <Tooltip text="Approve" position="top">
                                <button className="btn-icon approve" onClick={() => handleAction(item, 'approve')}>
                                  <Check size={16} />
                                </button>
                              </Tooltip>
                            )}
                            {['submitted', 'verified'].includes(item.status) && (
                              <Tooltip text="Reject" position="top">
                                <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                                  <X size={16} />
                                </button>
                              </Tooltip>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {['approved', 'rejected'].includes(item.status) && <span className="date-text">-</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {actionType === 'verify' && `Verify ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'}`}
                {actionType === 'approve' && `Approve ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'}`}
                {actionType === 'reject' && `Reject ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'}`}
              </h3>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to {actionType} <strong>{selectedItem?.reference}</strong>?</p>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">
                  Remarks {actionType === 'reject' && <span style={{ color: 'red' }}>*</span>}
                </label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={actionType === 'reject' ? 'Reason for rejection is required' : 'Optional remarks'}
                ></textarea>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className={`btn ${actionType === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                onClick={processAction}
              >
                Confirm {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsQueue;
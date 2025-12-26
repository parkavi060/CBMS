import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { budgetProposalAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import Tooltip from '../components/Tooltip/Tooltip';
import { Plus, Eye, Pencil, CheckCircle, XCircle, Clock, DollarSign, Send, Check, X, RefreshCcw, ShieldCheck } from 'lucide-react';
import './BudgetProposals.css';

const BudgetProposals = () => {
  const { user } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: ['admin', 'office', 'principal', 'vice_principal', 'auditor'].includes(user?.role) ? 'submitted' : '',
    financialYear: '2025-2026'
  });

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await budgetProposalAPI.getBudgetProposals(filters);
      setProposals(response.data.data.proposals);
      setError(null);
    } catch (err) {
      setError('Failed to fetch budget proposals');
      console.error('Error fetching proposals:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await budgetProposalAPI.getBudgetProposalsStats({ financialYear: filters.financialYear });
      setStats(response.data.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [filters.financialYear]);

  useEffect(() => {
    fetchProposals();
    fetchStats();
  }, [fetchProposals, fetchStats]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitProposal = async (id) => {
    if (!window.confirm('Are you sure you want to submit this proposal for approval? After submission, you will not be able to edit it unless it is sent back for revision.')) {
      return;
    }

    try {
      setLoading(true);
      await budgetProposalAPI.submitBudgetProposal(id);
      setError(null);
      // Refresh data
      fetchProposals();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit proposal');
      console.error('Error submitting proposal:', err);
      setLoading(false);
    }
  };

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApproveProposal = async (id) => {
    if (!window.confirm('Are you sure you want to approve this budget proposal?')) {
      return;
    }

    try {
      setLoading(true);
      await budgetProposalAPI.approveBudgetProposal(id, { notes: 'Approved from list view' });
      setError(null);
      fetchProposals();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve proposal');
      console.error('Error approving proposal:', err);
      setLoading(false);
    }
  };

  const handleRejectClick = (id) => {
    setSelectedProposalId(id);
    setShowRejectModal(true);
  };

  const handleRejectProposal = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      setLoading(true);
      await budgetProposalAPI.rejectBudgetProposal(selectedProposalId, { rejectionReason: rejectionReason });
      setShowRejectModal(false);
      setRejectionReason('');
      setError(null);
      fetchProposals();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject proposal');
      console.error('Error rejecting proposal:', err);
      setLoading(false);
    }
  };

  const handleResubmitProposal = async (id) => {
    if (!window.confirm('Do you want to create a new draft from this rejected proposal? This will allow you to make corrections and resubmit.')) {
      return;
    }

    try {
      setLoading(true);
      await budgetProposalAPI.resubmitBudgetProposal(id);
      setError(null);
      fetchProposals();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resubmit proposal');
      console.error('Error resubmitting proposal:', err);
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#ffc107',
      submitted: '#17a2b8',
      verified: '#6f42c1',
      approved: '#28a745',
      rejected: '#dc3545',
      revised: '#6c757d'
    };
    return colors[status] || '#6c757d';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={18} style={{ color: '#28a745' }} />;
      case 'rejected':
        return <XCircle size={18} style={{ color: '#dc3545' }} />;
      case 'verified':
        return <ShieldCheck size={18} style={{ color: '#6f42c1' }} />;
      case 'submitted':
        return <Clock size={18} style={{ color: '#17a2b8' }} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="budget-proposals-container">
        <div className="loading">Loading budget proposals...</div>
      </div>
    );
  }

  return (
    <div className="budget-proposals-container">
      <PageHeader
        title={['admin', 'office', 'principal', 'vice_principal', 'auditor'].includes(user?.role) ? 'Budget Proposals Approvals' : 'Budget Proposals Management'}
        subtitle={['admin', 'office', 'principal', 'vice_principal', 'auditor'].includes(user?.role) ? 'Review and approve budget proposals' : 'Create and manage budget proposals for your department'}
      >
        {['admin', 'office', 'principal', 'vice_principal', 'auditor'].includes(user?.role) ? null : (
          <Link to="/budget-proposals/add" className="btn btn-primary">
            <Plus size={18} /> Create Proposal
          </Link>
        )}
      </PageHeader>

      {error && <div className="error-message">{error}</div>}

      {stats && (
        <div className="stats-grid">
          <StatCard
            title="Total Proposals"
            value={stats.totalProposals}
            icon={<DollarSign size={24} />}
            color="var(--primary)"
          />
          <StatCard
            title="Submitted"
            value={stats.submittedProposals}
            icon={<Clock size={24} />}
            color="var(--info)"
          />
          <StatCard
            title="Approved"
            value={stats.approvedProposals}
            icon={<CheckCircle size={24} />}
            color="var(--success)"
          />
          <StatCard
            title="Rejected"
            value={stats.rejectedProposals}
            icon={<XCircle size={24} />}
            color="var(--danger)"
          />
          <StatCard
            title="Approved Amount"
            value={`₹${stats.totalApprovedAmount.toLocaleString('en-IN')}`}
            icon={<DollarSign size={24} />}
            color="var(--success)"
          />
        </div>
      )}

      <div className="filters-section">
        <div className="form-group">
          <label>Financial Year</label>
          <input
            type="text"
            name="financialYear"
            value={filters.financialYear}
            onChange={handleFilterChange}
            placeholder="e.g., 2025-2026"
          />
        </div>

        {!['admin', 'office', 'principal', 'vice_principal', 'auditor'].includes(user?.role) && (
          <div className="form-group">
            <label>Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="revised">Revised</option>
            </select>
          </div>
        )}
      </div>

      <div className="proposals-table-container">
        {proposals.length === 0 ? (
          <div className="empty-state">
            <p>No budget proposals found</p>
            <Link to="/budget-proposals/add" className="btn btn-primary btn-sm">
              Create First Proposal
            </Link>
          </div>
        ) : (
          <table className="proposals-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Financial Year</th>
                <th>Total Proposed</th>
                <th>Items</th>
                <th>Status</th>
                <th>Submitted Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal._id}>
                  <td>
                    <div className="dept-info">
                      <div className="dept-name">{proposal.department.name}</div>
                      <div className="dept-code">{proposal.department.code}</div>
                    </div>
                  </td>
                  <td>{proposal.financialYear}</td>
                  <td>
                    <span className="amount">
                      ₹{proposal.totalProposedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <span className="item-count">{proposal.proposalItems.length} items</span>
                  </td>
                  <td>
                    <div className="status-cell">
                      {getStatusIcon(proposal.status)}
                      <span className="status" style={{ backgroundColor: getStatusColor(proposal.status) }}>
                        {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td>
                    {proposal.submittedDate ? new Date(proposal.submittedDate).toLocaleDateString() : '-'}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Tooltip text="View Proposal" position="top">
                        <Link
                          to={`/budget-proposals/${proposal._id}`}
                          className="btn btn-sm btn-info"
                        >
                          <Eye size={16} />
                        </Link>
                      </Tooltip>
                      {(proposal.status === 'draft' || proposal.status === 'revised') && (
                        <>
                          <Tooltip text="Edit Proposal" position="top">
                            <Link
                              to={`/budget-proposals/edit/${proposal._id}`}
                              className="btn btn-sm btn-secondary"
                            >
                              <Pencil size={16} />
                            </Link>
                          </Tooltip>
                          <Tooltip text="Submit for Approval" position="top">
                            <button
                              onClick={() => handleSubmitProposal(proposal._id)}
                              className="btn btn-sm btn-success"
                              style={{ color: 'white' }}
                            >
                              <Send size={16} />
                            </button>
                          </Tooltip>
                        </>
                      )}
                      {proposal.status === 'rejected' && (
                        <Tooltip text="Resubmit (Copy to Draft)" position="top">
                          <button
                            onClick={() => handleResubmitProposal(proposal._id)}
                            className="btn btn-sm btn-warning"
                            style={{ color: 'white', backgroundColor: '#fd7e14', borderColor: '#fd7e14' }}
                          >
                            <RefreshCcw size={16} />
                          </button>
                        </Tooltip>
                      )}
                      {(proposal.status === 'submitted' || proposal.status === 'verified') && ['admin', 'office', 'principal', 'vice_principal'].includes(user?.role) && (
                        <>
                          {user?.role === 'office' && proposal.status === 'submitted' && (
                            <Tooltip text="Verify" position="top">
                              <button
                                onClick={() => budgetProposalAPI.verifyBudgetProposal(proposal._id, { remarks: 'Verified from list view' }).then(() => fetchProposals())}
                                className="btn btn-sm btn-primary"
                                style={{ color: 'white' }}
                              >
                                <Check size={16} />
                              </button>
                            </Tooltip>
                          )}
                          <Tooltip text="Approve" position="top">
                            <button
                              onClick={() => handleApproveProposal(proposal._id)}
                              className="btn btn-sm btn-success"
                              style={{ color: 'white' }}
                              disabled={proposal.status === 'submitted' && user?.role === 'office'} // Office verifies before approving
                            >
                              <Check size={16} />
                            </button>
                          </Tooltip>
                          <Tooltip text="Reject" position="top">
                            <button
                              onClick={() => handleRejectClick(proposal._id)}
                              className="btn btn-sm btn-danger"
                              style={{ color: 'white' }}
                            >
                              <X size={16} />
                            </button>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Reject Budget Proposal</h3>
              <button onClick={() => setShowRejectModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p>Please provide a reason for rejecting this budget proposal.</p>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Rejection Reason *</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason here..."
                ></textarea>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleRejectProposal}>Reject Proposal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetProposals;

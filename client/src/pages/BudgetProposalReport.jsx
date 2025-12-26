import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportAPI, departmentsAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import { FileText, RotateCw, Download, CheckCircle, Clock, XCircle, ShieldCheck, ArrowUpRight } from 'lucide-react';
import './BudgetProposalReport.css';

const BudgetProposalReport = () => {
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        financialYear: '2025-2026',
        department: '',
        status: ''
    });

    const fetchDepartments = useCallback(async () => {
        try {
            const response = await departmentsAPI.getDepartments();
            setDepartments(response.data.data.departments);
        } catch (err) {
            console.error('Error fetching departments:', err);
        }
    }, []);

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const response = await reportAPI.getBudgetProposalReport(filters);
            setReport(response.data.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch budget proposal report');
            console.error('Error fetching report:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchDepartments();
    }, [fetchDepartments]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircle size={16} className="text-success" />;
            case 'verified': return <ShieldCheck size={16} className="text-info" />;
            case 'submitted': return <Clock size={16} className="text-primary" />;
            case 'rejected': return <XCircle size={16} className="text-danger" />;
            default: return <FileText size={16} className="text-secondary" />;
        }
    };

    const exportToCSV = () => {
        if (!report || !report.proposals) return;

        let csv = 'Yearly Budget Proposal Report\n';
        csv += `Financial Year: ${filters.financialYear}\n`;
        csv += `Generated on: ${new Date().toLocaleString()}\n\n`;

        csv += 'Department,Status,Total Proposed Amount,Items Count,Submitted Date\n';
        report.proposals.forEach(p => {
            csv += `"${p.department.name}",${p.status},${p.totalProposedAmount},${p.proposalItems.length},${p.submittedDate ? new Date(p.submittedDate).toLocaleDateString() : 'N/A'}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-proposals-${filters.financialYear}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="proposal-report-container">
            <PageHeader
                title="Yearly Budget Proposal Report"
                subtitle="Consolidated view of proposed budgets for the upcoming year"
            >
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={fetchReport}>
                        <RotateCw size={18} /> Refresh
                    </button>
                    <button className="btn btn-primary" onClick={exportToCSV}>
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </PageHeader>

            {error && <div className="error-message">{error}</div>}

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

                <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={filters.department} onChange={handleFilterChange}>
                        <option value="">All Departments</option>
                        {departments.map(dept => (
                            <option key={dept._id} value={dept._id}>{dept.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={filters.status} onChange={handleFilterChange}>
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>

                <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
                    {loading ? 'Processing...' : 'Generate Summary'}
                </button>
            </div>

            {report && (
                <>
                    <div className="stats-grid">
                        <StatCard
                            title="Total Proposals"
                            value={report.summary.totalProposals}
                            icon={<FileText size={24} />}
                            color="var(--primary)"
                        />
                        <StatCard
                            title="Approved"
                            value={report.summary.byStatus.approved || 0}
                            icon={<CheckCircle size={24} />}
                            color="var(--success)"
                        />
                        <StatCard
                            title="Pending Approval"
                            value={(report.summary.byStatus.submitted || 0) + (report.summary.byStatus.verified || 0)}
                            icon={<Clock size={24} />}
                            color="var(--warning)"
                        />
                        <StatCard
                            title="Total Proposed Amount"
                            value={`₹${report.summary.totalProposedAmount.toLocaleString('en-IN')}`}
                            icon={<FileText size={24} />}
                            color="var(--info)"
                        />
                    </div>

                    <div className="report-section">
                        <div className="section-header">
                            <h3>Proposal Breakdown by Department</h3>
                        </div>
                        <div className="table-responsive">
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Department</th>
                                        <th>Status</th>
                                        <th className="text-right">Proposed Amount</th>
                                        <th className="text-center">Items</th>
                                        <th>Last Updated</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.proposals.length > 0 ? report.proposals.map(p => (
                                        <tr key={p._id}>
                                            <td>
                                                <div className="dept-info">
                                                    <span className="font-bold">{p.department.name}</span>
                                                    <span className="text-muted text-xs block">{p.department.code}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="status-badge">
                                                    {getStatusIcon(p.status)}
                                                    <span className={`status-text status-${p.status}`}>
                                                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="text-right font-mono">
                                                ₹{p.totalProposedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-center">{p.proposalItems.length}</td>
                                            <td className="text-sm text-muted">
                                                {new Date(p.updatedAt).toLocaleDateString()}
                                            </td>
                                            <td className="text-center">
                                                {p.status === 'approved' && (
                                                    <button
                                                        className="btn-action allocate"
                                                        onClick={() => navigate(`/allocations/add?proposalId=${p._id}&deptId=${p.department._id}&fy=${p.financialYear}`)}
                                                        title="Promote to Allocation"
                                                    >
                                                        <ArrowUpRight size={16} /> Allocate
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="text-center py-8 text-muted">No proposals found for the selected criteria</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default BudgetProposalReport;

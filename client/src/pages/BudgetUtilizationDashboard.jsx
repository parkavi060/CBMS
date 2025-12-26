import { useState, useEffect, useCallback } from 'react';
import { reportAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import './BudgetUtilizationDashboard.css';

const BudgetUtilizationDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialYear, setFinancialYear] = useState('2025-2026');

  const COLORS = ['#28a745', '#17a2b8', '#ffc107', '#fd7e14', '#dc3545'];
  const UTILIZATION_RANGES = ['0-25', '25-50', '50-75', '75-90', '90+'];

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await reportAPI.getBudgetUtilizationDashboard({ financialYear });
      setDashboard(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch budget utilization dashboard');
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [financialYear]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleYearChange = (e) => {
    setFinancialYear(e.target.value);
  };

  const getUtilizationData = () => {
    if (!dashboard) return [];
    return UTILIZATION_RANGES.map(range => ({
      range: `${range}%`,
      count: dashboard.utilizationRanges[range].count,
      totalAllocated: dashboard.utilizationRanges[range].totalAllocated
    }));
  };

  const getDepartmentData = () => {
    if (!dashboard) return [];
    return dashboard.departmentWiseUtilization.sort((a, b) => b.totalAllocated - a.totalAllocated).slice(0, 10);
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return '#dc3545';
    if (percentage >= 75) return '#ffc107';
    if (percentage >= 50) return '#17a2b8';
    return '#28a745';
  };

  if (loading) {
    return (
      <div className="budget-utilization-dashboard">
        <div className="loading">Loading budget utilization dashboard...</div>
      </div>
    );
  }

  return (
    <div className="budget-utilization-dashboard">
      <PageHeader
        title="Budget Utilization Dashboard"
        subtitle="Real-time budget utilization monitoring across departments"
      />

      {error && <div className="error-message">{error}</div>}

      <div className="filters-section">
        <div className="form-group">
          <label>Financial Year</label>
          <input
            type="text"
            value={financialYear}
            onChange={handleYearChange}
            placeholder="e.g., 2025-2026"
          />
        </div>
      </div>

      {dashboard && (
        <>
          {/* Key Metrics */}
          <div className="stats-grid">
            <StatCard
              title="Total Departments"
              value={dashboard.totalDepartments}
              icon={<TrendingUp size={24} />}
              color="var(--primary)"
            />
            <StatCard
              title="High Utilization (≥90%)"
              value={dashboard.departmentsWithHighUtilization}
              subtitle="Requires attention"
              icon={<AlertCircle size={24} />}
              color="var(--danger)"
            />
            <StatCard
              title="Low Utilization (<50%)"
              value={dashboard.departmentsWithLowUtilization}
              subtitle="Underutilized budgets"
              icon={<TrendingDown size={24} />}
              color="var(--warning)"
            />
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            {/* Utilization Range Distribution */}
            <div className="chart-container">
              <h3>Distribution by Utilization Range</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getUtilizationData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="Number of Allocations" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Departments by Allocation */}
            <div className="chart-container">
              <h3>Top 10 Departments by Budget Allocation</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getDepartmentData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="code" type="category" width={80} />
                  <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                  <Bar dataKey="totalAllocated" fill="#8884d8" name="Allocated" />
                  <Bar dataKey="totalSpent" fill="#82ca9d" name="Spent" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Utilization Pie Chart */}
            <div className="chart-container">
              <h3>Allocations by Utilization Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={UTILIZATION_RANGES.map(range => ({
                      name: `${range}%`,
                      value: dashboard.utilizationRanges[range].count
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {UTILIZATION_RANGES.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* High Utilization Alert */}
          {dashboard.departmentsWithHighUtilization > 0 && (
            <div className="alert alert-warning">
              <AlertCircle size={20} />
              <div>
                <strong>{dashboard.departmentsWithHighUtilization} department(s)</strong> have budget utilization ≥90%. 
                Consider allocating additional funds if needed.
              </div>
            </div>
          )}

          {/* Low Utilization Alert */}
          {dashboard.departmentsWithLowUtilization > 0 && (
            <div className="alert alert-info">
              <TrendingDown size={20} />
              <div>
                <strong>{dashboard.departmentsWithLowUtilization} department(s)</strong> have budget utilization &lt;50%. 
                Review spending plans and reallocate if necessary.
              </div>
            </div>
          )}

          {/* Department-wise Utilization Table */}
          <div className="report-section">
            <h3>Department-wise Utilization Details</h3>
            <div className="table-container">
              <table className="utilization-table">
                <thead>
                  <tr>
                    <th>Department Code</th>
                    <th>Total Allocated</th>
                    <th>Total Spent</th>
                    <th>Utilization %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.departmentWiseUtilization.map((dept) => (
                    <tr key={dept.departmentId}>
                      <td>{dept.code}</td>
                      <td>₹{dept.totalAllocated.toLocaleString('en-IN')}</td>
                      <td>₹{dept.totalSpent.toLocaleString('en-IN')}</td>
                      <td>
                        <div className="utilization-cell">
                          <div className="utilization-bar">
                            <div
                              className="utilization-fill"
                              style={{
                                width: `${Math.min(dept.utilizationPercentage, 100)}%`,
                                backgroundColor: getStatusColor(dept.utilizationPercentage)
                              }}
                            />
                          </div>
                          <span className="percentage">{dept.utilizationPercentage}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status status-${
                          dept.utilizationPercentage >= 90 ? 'critical' :
                          dept.utilizationPercentage >= 75 ? 'warning' :
                          dept.utilizationPercentage >= 50 ? 'moderate' : 'low'
                        }`}>
                          {dept.utilizationPercentage >= 90 ? 'Critical' :
                           dept.utilizationPercentage >= 75 ? 'High' :
                           dept.utilizationPercentage >= 50 ? 'Moderate' : 'Low'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="legend-section">
            <h4>Utilization Status Legend</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="status status-low" />
                <span>Low (0-50%)</span>
              </div>
              <div className="legend-item">
                <span className="status status-moderate" />
                <span>Moderate (50-75%)</span>
              </div>
              <div className="legend-item">
                <span className="status status-warning" />
                <span>High (75-90%)</span>
              </div>
              <div className="legend-item">
                <span className="status status-critical" />
                <span>Critical (≥90%)</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BudgetUtilizationDashboard;

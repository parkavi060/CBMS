const BudgetProposal = require('../models/BudgetProposal');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');
const Allocation = require('../models/Allocation');
const AuditLog = require('../models/AuditLog');
const { recordAuditLog } = require('../utils/auditService');

// @desc    Get all budget proposals
// @route   GET /api/budget-proposals
// @access  Private
const getBudgetProposals = async (req, res) => {
  try {
    const { financialYear, department, status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (financialYear) query.financialYear = financialYear;
    if (status) query.status = status;

    // Department and HOD users can only see their own department's proposals
    if (['department', 'hod'].includes(req.user.role)) {
      query.department = req.user.department;
    } else if (department) {
      // Admin, principal, vice_principal, office, auditor can filter by department
      query.department = department;
    }

    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      BudgetProposal.find(query)
        .populate('department', 'name code')
        .populate('proposalItems.budgetHead', 'name category budgetType')
        .populate('submittedBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BudgetProposal.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        proposals,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching budget proposals',
      error: error.message
    });
  }
};

// @desc    Get budget proposal by ID
// @route   GET /api/budget-proposals/:id
// @access  Private
const getBudgetProposalById = async (req, res) => {
  try {
    const proposal = await BudgetProposal.findById(req.params.id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Department and HOD users can only view their own department's proposals
    if (['department', 'hod'].includes(req.user.role) &&
      proposal.department._id.toString() !== req.user.department.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this proposal'
      });
    }

    res.status(200).json({
      success: true,
      data: { proposal }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching budget proposal',
      error: error.message
    });
  }
};

// @desc    Create budget proposal
// @route   POST /api/budget-proposals
// @access  Private
const createBudgetProposal = async (req, res) => {
  try {
    const { financialYear, department, proposalItems, notes, status } = req.body;

    // Validate status if provided
    if (status && !['draft', 'submitted'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided for creation'
      });
    }

    // Department and HOD users can only create proposals for their own department
    let deptToUse = department;
    if (['department', 'hod'].includes(req.user.role)) {
      deptToUse = req.user.department.toString();
      if (department && department !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only create proposals for your own department'
        });
      }
    }

    // Validate department exists
    const departmentExists = await Department.findById(deptToUse);
    if (!departmentExists) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Validate budget heads exist
    const budgetHeadIds = proposalItems.map(item => item.budgetHead);
    const budgetHeads = await BudgetHead.find({ _id: { $in: budgetHeadIds } });
    if (budgetHeads.length !== budgetHeadIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more budget heads are invalid'
      });
    }

    // Check if proposal already exists for this FY and department
    const existingProposal = await BudgetProposal.findOne({
      financialYear,
      department,
      status: { $in: ['draft', 'submitted'] }
    });

    if (existingProposal) {
      return res.status(400).json({
        success: false,
        message: 'Budget proposal already exists for this financial year and department'
      });
    }

    const proposal = await BudgetProposal.create({
      financialYear,
      department: deptToUse,
      proposalItems,
      notes,
      status: status || 'draft',
      submittedBy: req.user._id
    });

    // Populate the created proposal
    const populatedProposal = await BudgetProposal.findById(proposal._id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_created',
      req,
      targetEntity: 'BudgetProposal',
      targetId: proposal._id,
      details: {
        financialYear,
        department: deptToUse,
        itemCount: proposalItems.length
      },
      newValues: populatedProposal
    });

    res.status(201).json({
      success: true,
      data: { proposal: populatedProposal },
      message: 'Budget proposal created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating budget proposal',
      error: error.message
    });
  }
};

// @desc    Update budget proposal
// @route   PUT /api/budget-proposals/:id
// @access  Private
const updateBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { proposalItems, notes, financialYear, department, status } = req.body;

    console.log('[Debug] updateBudgetProposal called with id:', id);
    console.log('[Debug] Request body:', req.body);
    console.log('[Debug] User info - id:', req.user._id, 'role:', req.user.role, 'department:', req.user.department);

    const proposal = await BudgetProposal.findById(id).populate('department');
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Department and HOD users can only edit their own department's proposals
    if (['department', 'hod'].includes(req.user.role)) {
      if (proposal.department._id.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only edit proposals from your own department'
        });
      }
      // Department users can only edit their own proposals; HOD can edit any in their dept
      if (req.user.role === 'department' && proposal.submittedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only edit your own proposals'
        });
      }
    }

    console.log('[Debug] updateBudgetProposal called with id:', id);
    console.log('[Debug] Request body:', req.body);
    console.log('[Debug] User info - id:', req.user._id, 'role:', req.user.role, 'department:', req.user.department);

    // Can only edit draft proposals
    if (proposal.status !== 'draft' && proposal.status !== 'revised') {
      console.log('[Debug] Cannot edit - status is:', proposal.status);
      return res.status(400).json({
        success: false,
        message: 'Can only edit draft or revised proposals'
      });
    }

    // Extract data from request body
    const { proposalItems: bodyProposalItems, notes: bodyNotes, financialYear: bodyFinancialYear, status: bodyStatus } = req.body;

    console.log('[Debug] Extracted - proposalItems count:', bodyProposalItems?.length, 'notes:', bodyNotes?.substring(0, 50), 'FY:', bodyFinancialYear, 'Status:', bodyStatus);

    // Validate budget heads if updating items
    if (bodyProposalItems && Array.isArray(bodyProposalItems)) {
      console.log('[Debug] Validating proposalItems...');
      const budgetHeadIds = bodyProposalItems.map(item => item.budgetHead).filter(id => id);

      if (budgetHeadIds.length === 0) {
        console.log('[Debug] No valid budget head IDs found');
        return res.status(400).json({
          success: false,
          message: 'All proposal items must have a budget head selected',
          error: 'Missing budgetHead in items'
        });
      }

      const budgetHeads = await BudgetHead.find({ _id: { $in: budgetHeadIds } });
      console.log('[Debug] Found budget heads:', budgetHeads.length, 'Expected:', budgetHeadIds.length);

      if (budgetHeads.length !== budgetHeadIds.length) {
        console.log('[Debug] Budget head validation failed');
        return res.status(400).json({
          success: false,
          message: 'One or more budget heads are invalid',
          provided: budgetHeadIds.length,
          found: budgetHeads.length
        });
      }
    }

    const oldData = { ...proposal.toObject() };

    // Update fields
    if (bodyProposalItems) proposal.proposalItems = bodyProposalItems;
    if (bodyNotes !== undefined) proposal.notes = bodyNotes;
    if (bodyFinancialYear) proposal.financialYear = bodyFinancialYear;
    if (bodyStatus && ['draft', 'submitted'].includes(bodyStatus)) {
      proposal.status = bodyStatus;
    }
    proposal.lastModifiedBy = req.user._id;

    console.log('[Debug] Saving proposal...');
    await proposal.save();
    console.log('[Debug] Proposal saved successfully');

    const updatedProposal = await BudgetProposal.findById(id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_updated',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: {
        financialYear: bodyFinancialYear || proposal.financialYear,
        itemCount: bodyProposalItems?.length || proposal.proposalItems.length
      },
      previousValues: oldData,
      newValues: updatedProposal.toObject()
    });

    res.status(200).json({
      success: true,
      data: { proposal: updatedProposal },
      message: 'Budget proposal updated successfully'
    });
  } catch (error) {
    console.error('[Error] updateBudgetProposal error:', error.message);
    console.error('[Error] Error stack:', error.stack);
    if (error.name === 'ValidationError') {
      console.error('[Error] Validation error details:', Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
    res.status(500).json({
      success: false,
      message: 'Error updating budget proposal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      validationErrors: process.env.NODE_ENV === 'development' && error.name === 'ValidationError' ?
        Object.keys(error.errors).map(key => ({ field: key, message: error.errors[key].message })) : undefined
    });
  }
};

// @desc    Submit budget proposal
// @route   PUT /api/budget-proposals/:id/submit
// @access  Private
const submitBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await BudgetProposal.findById(id).populate('department');
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Department and HOD users can only submit their own department's proposals
    if (['department', 'hod'].includes(req.user.role)) {
      if (proposal.department._id.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only submit proposals from your own department'
        });
      }
      // They can only submit their own proposals (or their department's if they're HOD)
      // Allow HOD to submit department proposals too
      if (req.user.role === 'department' && proposal.submittedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only submit your own proposals'
        });
      }
    }

    if (proposal.status !== 'draft' && proposal.status !== 'revised') {
      return res.status(400).json({
        success: false,
        message: 'Only draft or revised proposals can be submitted'
      });
    }

    if (!proposal.proposalItems || proposal.proposalItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Proposal must have at least one item'
      });
    }

    proposal.status = 'submitted';
    proposal.submittedDate = new Date();
    proposal.lastModifiedBy = req.user._id;
    await proposal.save();

    const updatedProposal = await BudgetProposal.findById(id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_submitted',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: {
        submittedDate: proposal.submittedDate
      }
    });

    res.status(200).json({
      success: true,
      data: { proposal: updatedProposal },
      message: 'Budget proposal submitted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting budget proposal',
      error: error.message
    });
  }
};

// @desc    Approve budget proposal
// @route   PUT /api/budget-proposals/:id/approve
// @access  Private (Admin/Principal/Vice Principal/Office)
const approveBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const proposal = await BudgetProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Role check for approval
    const allowedApprovalRoles = ['admin', 'principal', 'vice_principal', 'office'];
    if (!allowedApprovalRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve budget proposals'
      });
    }

    // Must be verified or submitted
    if (!['submitted', 'verified'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or verified proposals can be approved'
      });
    }

    proposal.status = 'approved';
    proposal.approvedDate = new Date();
    proposal.approvedBy = req.user._id;
    if (notes) proposal.notes = notes;
    proposal.lastModifiedBy = req.user._id;

    // Add approval step
    proposal.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'approve',
      remarks: notes || '',
      timestamp: new Date()
    });

    await proposal.save();

    const updatedProposal = await BudgetProposal.findById(id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_approved',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: {
        approvedDate: proposal.approvedDate,
        notes
      }
    });

    res.status(200).json({
      success: true,
      data: { proposal: updatedProposal },
      message: 'Budget proposal approved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving budget proposal',
      error: error.message
    });
  }
};

// @desc    Verify budget proposal
// @route   PUT /api/budget-proposals/:id/verify
// @access  Private (HOD/Office)
const verifyBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const proposal = await BudgetProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Check permissions
    if (req.user.role === 'hod') {
      if (proposal.department.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only verify proposals from your department'
        });
      }
    } else if (req.user.role !== 'office' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only HOD or Office can verify budget proposals'
      });
    }

    if (proposal.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Only submitted proposals can be verified'
      });
    }

    proposal.status = 'verified';
    proposal.lastModifiedBy = req.user._id;

    // Add verification step
    proposal.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'verify',
      remarks: remarks || '',
      timestamp: new Date()
    });

    await proposal.save();

    const populatedProposal = await BudgetProposal.findById(id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_verified',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: { remarks }
    });

    res.json({
      success: true,
      message: 'Budget proposal verified successfully',
      data: { proposal: populatedProposal }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying budget proposal',
      error: error.message
    });
  }
};

// @desc    Reject budget proposal
// @route   PUT /api/budget-proposals/:id/reject
// @access  Private (Admin/Principal/Vice Principal/Office/HOD)
const rejectBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const proposal = await BudgetProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Role check for rejection
    const allowedRejectRoles = ['admin', 'principal', 'vice_principal', 'office', 'hod'];
    if (!allowedRejectRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject budget proposals'
      });
    }

    if (!['submitted', 'verified'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or verified proposals can be rejected'
      });
    }

    proposal.status = 'rejected';
    proposal.rejectionReason = rejectionReason;
    proposal.lastModifiedBy = req.user._id;

    // Add rejection step
    proposal.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'reject',
      remarks: rejectionReason,
      timestamp: new Date()
    });

    await proposal.save();

    const updatedProposal = await BudgetProposal.findById(id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_rejected',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: { rejectionReason }
    });

    res.status(200).json({
      success: true,
      data: { proposal: updatedProposal },
      message: 'Budget proposal rejected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting budget proposal',
      error: error.message
    });
  }
};

// @desc    Resubmit budget proposal (creates a new draft from rejected)
// @route   POST /api/budget-proposals/:id/resubmit
// @access  Private
const resubmitBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const originalProposal = await BudgetProposal.findById(id);
    if (!originalProposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    if (originalProposal.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Only rejected proposals can be resubmitted'
      });
    }

    // Authorization check
    if (['department', 'hod'].includes(req.user.role)) {
      if (originalProposal.department.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only resubmit proposals for your own department'
        });
      }
    }

    // Create a new draft based on the original
    const newProposal = await BudgetProposal.create({
      financialYear: originalProposal.financialYear,
      department: originalProposal.department,
      proposalItems: originalProposal.proposalItems.map(item => ({
        budgetHead: item.budgetHead,
        proposedAmount: item.proposedAmount,
        justification: item.justification,
        previousYearUtilization: item.previousYearUtilization
      })),
      notes: `Resubmission of rejected proposal ${id}. ${originalProposal.notes || ''}`,
      status: 'draft',
      submittedBy: req.user._id
    });

    // Update original proposal as 'revised'
    originalProposal.status = 'revised';
    await originalProposal.save();

    const populatedProposal = await BudgetProposal.findById(newProposal._id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_created',
      req,
      targetEntity: 'BudgetProposal',
      targetId: newProposal._id,
      details: {
        isResubmission: true,
        originalProposalId: id
      }
    });

    res.status(201).json({
      success: true,
      data: { proposal: populatedProposal },
      message: 'Draft created from rejected proposal'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resubmitting budget proposal',
      error: error.message
    });
  }
};

// @desc    Get budget proposals stats
// @route   GET /api/budget-proposals/stats
// @access  Private
const getBudgetProposalsStats = async (req, res) => {
  try {
    const { financialYear } = req.query;

    const query = {};
    if (financialYear) query.financialYear = financialYear;

    // Department and HOD users get stats for their own department only
    if (['department', 'hod'].includes(req.user.role)) {
      query.department = req.user.department;
    }

    const [
      totalProposals,
      submittedProposals,
      approvedProposals,
      rejectedProposals,
      draftProposals,
      totalProposedAmount
    ] = await Promise.all([
      BudgetProposal.countDocuments(query),
      BudgetProposal.countDocuments({ ...query, status: 'submitted' }),
      BudgetProposal.countDocuments({ ...query, status: 'approved' }),
      BudgetProposal.countDocuments({ ...query, status: 'rejected' }),
      BudgetProposal.countDocuments({ ...query, status: 'draft' }),
      BudgetProposal.aggregate([
        { $match: { ...query, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$totalProposedAmount' } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProposals,
        submittedProposals,
        approvedProposals,
        rejectedProposals,
        draftProposals,
        totalApprovedAmount: totalProposedAmount[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching budget proposals stats',
      error: error.message
    });
  }
};

// @desc    Delete budget proposal
// @route   DELETE /api/budget-proposals/:id
// @access  Private
const deleteBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await BudgetProposal.findById(id).populate('department');
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Only allow deletion of draft or rejected proposals
    if (!['draft', 'rejected'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected proposals can be deleted'
      });
    }

    // Department and HOD users can only delete their own department's proposals
    if (['department', 'hod'].includes(req.user.role)) {
      if (proposal.department._id.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete proposals from your own department'
        });
      }
      // Department users can only delete their own proposals; HOD can delete any in their dept
      if (req.user.role === 'department' && proposal.submittedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own proposals'
        });
      }
    }

    // Delete the proposal
    await BudgetProposal.findByIdAndDelete(id);

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_deleted',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: {
        financialYear: proposal.financialYear,
        department: proposal.department.name
      },
      previousValues: proposal.toObject()
    });

    res.status(200).json({
      success: true,
      message: 'Budget proposal deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting budget proposal',
      error: error.message
    });
  }
};

module.exports = {
  getBudgetProposals,
  getBudgetProposalById,
  createBudgetProposal,
  updateBudgetProposal,
  submitBudgetProposal,
  resubmitBudgetProposal,
  verifyBudgetProposal,
  approveBudgetProposal,
  rejectBudgetProposal,
  deleteBudgetProposal,
  getBudgetProposalsStats
};

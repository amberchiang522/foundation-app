import { supabase } from '@/lib/supabase'
import type {
  Organization,
  OrganizationWithDetails,
  VisitRecord,
  VisitRecordWithDetails,
  UpcomingVisit,
  UpcomingVisitWithDetails,
  SubsidyRecord,
  OrganizationCategory,
  OrganizationCategoryItem,
  CooperationStatus,
  VisitStatus,
  ImageData,
} from '@/types'

// Helper to convert snake_case to camelCase for Organization
function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as OrganizationCategory,
    categoryName: row.category_name as string | undefined,
    cooperationStatus: row.cooperation_status as CooperationStatus | undefined,
    contactPerson: row.contact_person as string | undefined,
    address: row.address as string | undefined,
    addressUrl: row.address_url as string | undefined,
    phone: row.phone as string | undefined,
    website: row.website as string | undefined,
    lineId: row.line_id as string | undefined,
    notes: row.notes as string | undefined,
    planIds: (row.plan_ids as string[]) || [],
    subsidyItems: row.subsidy_items as string | undefined,
    subsidyAmount: row.subsidy_amount as number | undefined,
    deliveryMethod: row.delivery_method as string | undefined,
    deliveryStatus: row.delivery_status as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// Helper to convert snake_case to camelCase for VisitRecord
function mapVisitRecord(row: Record<string, unknown>): VisitRecord {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    visitDate: row.visit_date as string,
    visitorIds: (row.visitor_ids as string[]) || [],
    customVisitors: (row.custom_visitors as string[]) || [],
    purpose: row.purpose as string | undefined,
    content: row.content as string | undefined,
    orgRequests: row.org_requests as string | undefined,
    foundationRequests: row.foundation_requests as string | undefined,
    nextSteps: row.next_steps as string | undefined,
    nextStepsFoundation: (row.next_steps_foundation as VisitRecord['nextStepsFoundation']) || [],
    nextStepsOrg: (row.next_steps_org as VisitRecord['nextStepsOrg']) || [],
    progressUpdate: row.progress_update as string | undefined,
    progressUpdates: (row.progress_updates as VisitRecord['progressUpdates']) || [],
    attachments: (row.attachments as ImageData[]) || [],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// Helper to convert snake_case to camelCase for SubsidyRecord
function mapSubsidyRecord(row: Record<string, unknown>): SubsidyRecord {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    subsidyDate: row.subsidy_date as string | undefined,
    subsidyItems: row.subsidy_items as string,
    subsidyAmount: row.subsidy_amount as number | undefined,
    deliveryMethod: row.delivery_method as string | undefined,
    deliveryStatus: row.delivery_status as string | undefined,
    notes: row.notes as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// Helper to convert snake_case to camelCase for UpcomingVisit
function mapUpcomingVisit(row: Record<string, unknown>): UpcomingVisit {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    plannedDate: row.planned_date as string,
    plannedTime: row.planned_time as string | undefined,
    purpose: row.purpose as string | undefined,
    assignedUserIds: (row.assigned_user_ids as string[]) || [],
    status: row.status as VisitStatus,
    notes: row.notes as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export const supabaseOrganizationService = {
  // =====================================================
  // Organizations
  // =====================================================

  async getOrganizations(): Promise<OrganizationWithDetails[]> {
    // Fetch all data in parallel to avoid N+1 queries
    const [
      { data: orgsData, error: orgsError },
      { data: allPlans },
      { data: visitRecords },
      { data: upcomingVisits },
    ] = await Promise.all([
      supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('plans')
        .select('id, name'),
      supabase
        .from('visit_records')
        .select('organization_id, visit_date'),
      supabase
        .from('upcoming_visits')
        .select('organization_id, status'),
    ])

    if (orgsError) throw orgsError

    const plansMap = new Map((allPlans || []).map(p => [p.id, p.name]))

    // Pre-compute visit stats from fetched data
    const visitCountMap = new Map<string, number>()
    const lastVisitMap = new Map<string, string>()
    const upcomingCountMap = new Map<string, number>()

    // Count visits and find last visit date per organization
    for (const record of visitRecords || []) {
      const orgId = record.organization_id
      visitCountMap.set(orgId, (visitCountMap.get(orgId) || 0) + 1)

      const currentLast = lastVisitMap.get(orgId)
      if (!currentLast || record.visit_date > currentLast) {
        lastVisitMap.set(orgId, record.visit_date)
      }
    }

    // Count pending upcoming visits per organization
    for (const visit of upcomingVisits || []) {
      if (visit.status === 'pending') {
        const orgId = visit.organization_id
        upcomingCountMap.set(orgId, (upcomingCountMap.get(orgId) || 0) + 1)
      }
    }

    // Map organizations with their stats
    const orgs: OrganizationWithDetails[] = (orgsData || []).map(row => {
      const org = mapOrganization(row)
      const plans = (org.planIds || [])
        .filter(id => plansMap.has(id))
        .map(id => ({ id, name: plansMap.get(id)! }))

      return {
        ...org,
        plans,
        visitCount: visitCountMap.get(org.id) || 0,
        lastVisitDate: lastVisitMap.get(org.id),
        upcomingVisitCount: upcomingCountMap.get(org.id) || 0,
      }
    })

    return orgs
  },

  async getOrganizationById(id: string): Promise<OrganizationWithDetails | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    // Fetch plan names
    const orgData = mapOrganization(data)
    let plans: { id: string; name: string }[] = []
    if (orgData.planIds && orgData.planIds.length > 0) {
      const { data: planData } = await supabase
        .from('plans')
        .select('id, name')
        .in('id', orgData.planIds)
      plans = (planData || []).map(p => ({ id: p.id, name: p.name }))
    }

    const org: OrganizationWithDetails = {
      ...orgData,
      plans,
    }

    // Fetch visit stats
    const { count: visitCount } = await supabase
      .from('visit_records')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)

    const { data: lastVisit } = await supabase
      .from('visit_records')
      .select('visit_date')
      .eq('organization_id', id)
      .order('visit_date', { ascending: false })
      .limit(1)
      .single()

    const { count: upcomingCount } = await supabase
      .from('upcoming_visits')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)
      .eq('status', 'pending')

    org.visitCount = visitCount || 0
    org.lastVisitDate = lastVisit?.visit_date
    org.upcomingVisitCount = upcomingCount || 0

    return org
  },

  async createOrganization(data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const { data: result, error } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        category: data.category,
        category_name: data.categoryName,
        cooperation_status: data.cooperationStatus || 'evaluating',
        contact_person: data.contactPerson,
        address: data.address,
        address_url: data.addressUrl,
        phone: data.phone,
        website: data.website,
        line_id: data.lineId,
        notes: data.notes,
        plan_ids: data.planIds || [],
        subsidy_items: data.subsidyItems,
        subsidy_amount: data.subsidyAmount,
        delivery_method: data.deliveryMethod,
        delivery_status: data.deliveryStatus,
        created_by: data.createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return mapOrganization(result)
  },

  async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization | null> {
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.category !== undefined) updateData.category = data.category
    if (data.categoryName !== undefined) updateData.category_name = data.categoryName
    if (data.cooperationStatus !== undefined) updateData.cooperation_status = data.cooperationStatus
    if (data.contactPerson !== undefined) updateData.contact_person = data.contactPerson
    if (data.address !== undefined) updateData.address = data.address
    if (data.addressUrl !== undefined) updateData.address_url = data.addressUrl
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.website !== undefined) updateData.website = data.website
    if (data.lineId !== undefined) updateData.line_id = data.lineId
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.planIds !== undefined) updateData.plan_ids = data.planIds
    if (data.subsidyItems !== undefined) updateData.subsidy_items = data.subsidyItems
    if (data.subsidyAmount !== undefined) updateData.subsidy_amount = data.subsidyAmount
    if (data.deliveryMethod !== undefined) updateData.delivery_method = data.deliveryMethod
    if (data.deliveryStatus !== undefined) updateData.delivery_status = data.deliveryStatus

    const { data: result, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return mapOrganization(result)
  },

  async deleteOrganization(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  // =====================================================
  // Visit Records
  // =====================================================

  async getVisitRecords(organizationId: string): Promise<VisitRecordWithDetails[]> {
    const { data, error } = await supabase
      .from('visit_records')
      .select('*')
      .eq('organization_id', organizationId)
      .order('visit_date', { ascending: false })

    if (error) throw error

    const records = (data || []).map(mapVisitRecord)

    // Collect all unique visitor IDs
    const allVisitorIds = new Set<string>()
    for (const record of records) {
      for (const id of record.visitorIds) {
        allVisitorIds.add(id)
      }
    }

    // Fetch all visitors in one query
    let visitorsMap = new Map<string, { id: string; name: string }>()
    if (allVisitorIds.size > 0) {
      const { data: visitors } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', Array.from(allVisitorIds))

      visitorsMap = new Map((visitors || []).map(v => [v.id, { id: v.id, name: v.name }]))
    }

    // Map visitors to records
    return records.map(record => ({
      ...record,
      visitors: record.visitorIds
        .map(id => visitorsMap.get(id))
        .filter((v): v is { id: string; name: string } => v !== undefined),
    }))
  },

  async getVisitRecordById(id: string): Promise<VisitRecordWithDetails | null> {
    const { data, error } = await supabase
      .from('visit_records')
      .select(`
        *,
        organizations:organization_id (id, name)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    const record: VisitRecordWithDetails = {
      ...mapVisitRecord(data),
      organization: data.organizations ? { id: data.organizations.id, name: data.organizations.name } : undefined,
    }

    // Fetch visitor names
    if (record.visitorIds.length > 0) {
      const { data: visitors } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', record.visitorIds)

      record.visitors = visitors || []
    }

    return record
  },

  async createVisitRecord(data: Omit<VisitRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<VisitRecord> {
    const { data: result, error } = await supabase
      .from('visit_records')
      .insert({
        organization_id: data.organizationId,
        visit_date: data.visitDate,
        visitor_ids: data.visitorIds,
        custom_visitors: data.customVisitors || [],
        purpose: data.purpose,
        content: data.content,
        org_requests: data.orgRequests,
        foundation_requests: data.foundationRequests,
        next_steps: data.nextSteps,
        next_steps_foundation: data.nextStepsFoundation || [],
        next_steps_org: data.nextStepsOrg || [],
        progress_update: data.progressUpdate,
        progress_updates: data.progressUpdates || [],
        attachments: data.attachments || [],
        created_by: data.createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return mapVisitRecord(result)
  },

  async updateVisitRecord(id: string, data: Partial<VisitRecord>): Promise<VisitRecord | null> {
    const updateData: Record<string, unknown> = {}

    if (data.visitDate !== undefined) updateData.visit_date = data.visitDate
    if (data.visitorIds !== undefined) updateData.visitor_ids = data.visitorIds
    if (data.customVisitors !== undefined) updateData.custom_visitors = data.customVisitors
    if (data.purpose !== undefined) updateData.purpose = data.purpose
    if (data.content !== undefined) updateData.content = data.content
    if (data.orgRequests !== undefined) updateData.org_requests = data.orgRequests
    if (data.foundationRequests !== undefined) updateData.foundation_requests = data.foundationRequests
    if (data.nextSteps !== undefined) updateData.next_steps = data.nextSteps
    if (data.nextStepsFoundation !== undefined) updateData.next_steps_foundation = data.nextStepsFoundation
    if (data.nextStepsOrg !== undefined) updateData.next_steps_org = data.nextStepsOrg
    if (data.progressUpdate !== undefined) updateData.progress_update = data.progressUpdate
    if (data.progressUpdates !== undefined) updateData.progress_updates = data.progressUpdates
    if (data.attachments !== undefined) updateData.attachments = data.attachments

    const { data: result, error } = await supabase
      .from('visit_records')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return mapVisitRecord(result)
  },

  async deleteVisitRecord(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('visit_records')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  // =====================================================
  // Upcoming Visits
  // =====================================================

  async getUpcomingVisits(organizationId?: string): Promise<UpcomingVisitWithDetails[]> {
    let query = supabase
      .from('upcoming_visits')
      .select(`
        *,
        organizations:organization_id (id, name)
      `)
      .order('planned_date', { ascending: true })

    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    const { data, error } = await query

    if (error) throw error

    const visits = (data || []).map(row => ({
      ...mapUpcomingVisit(row),
      organization: row.organizations ? { id: row.organizations.id, name: row.organizations.name } : undefined,
    }))

    // Collect all unique user IDs
    const allUserIds = new Set<string>()
    for (const visit of visits) {
      for (const id of visit.assignedUserIds) {
        allUserIds.add(id)
      }
    }

    // Fetch all users in one query
    let usersMap = new Map<string, { id: string; name: string }>()
    if (allUserIds.size > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', Array.from(allUserIds))

      usersMap = new Map((users || []).map(u => [u.id, { id: u.id, name: u.name }]))
    }

    // Map users to visits
    return visits.map(visit => ({
      ...visit,
      assignedUsers: visit.assignedUserIds
        .map(id => usersMap.get(id))
        .filter((u): u is { id: string; name: string } => u !== undefined),
    }))
  },

  async getPendingUpcomingVisits(): Promise<UpcomingVisitWithDetails[]> {
    const { data, error } = await supabase
      .from('upcoming_visits')
      .select(`
        *,
        organizations:organization_id (id, name)
      `)
      .eq('status', 'pending')
      .gte('planned_date', new Date().toISOString().split('T')[0])
      .order('planned_date', { ascending: true })
      .limit(10)

    if (error) throw error

    const visits = (data || []).map(row => ({
      ...mapUpcomingVisit(row),
      organization: row.organizations ? { id: row.organizations.id, name: row.organizations.name } : undefined,
    }))

    // Collect all unique user IDs
    const allUserIds = new Set<string>()
    for (const visit of visits) {
      for (const id of visit.assignedUserIds) {
        allUserIds.add(id)
      }
    }

    // Fetch all users in one query
    let usersMap = new Map<string, { id: string; name: string }>()
    if (allUserIds.size > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', Array.from(allUserIds))

      usersMap = new Map((users || []).map(u => [u.id, { id: u.id, name: u.name }]))
    }

    // Map users to visits
    return visits.map(visit => ({
      ...visit,
      assignedUsers: visit.assignedUserIds
        .map(id => usersMap.get(id))
        .filter((u): u is { id: string; name: string } => u !== undefined),
    }))
  },

  async createUpcomingVisit(data: Omit<UpcomingVisit, 'id' | 'createdAt' | 'updatedAt'>): Promise<UpcomingVisit> {
    const { data: result, error } = await supabase
      .from('upcoming_visits')
      .insert({
        organization_id: data.organizationId,
        planned_date: data.plannedDate,
        planned_time: data.plannedTime,
        purpose: data.purpose,
        assigned_user_ids: data.assignedUserIds,
        status: data.status,
        notes: data.notes,
        created_by: data.createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return mapUpcomingVisit(result)
  },

  async updateUpcomingVisit(id: string, data: Partial<UpcomingVisit>): Promise<UpcomingVisit | null> {
    const updateData: Record<string, unknown> = {}

    if (data.plannedDate !== undefined) updateData.planned_date = data.plannedDate
    if (data.plannedTime !== undefined) updateData.planned_time = data.plannedTime
    if (data.purpose !== undefined) updateData.purpose = data.purpose
    if (data.assignedUserIds !== undefined) updateData.assigned_user_ids = data.assignedUserIds
    if (data.status !== undefined) updateData.status = data.status
    if (data.notes !== undefined) updateData.notes = data.notes

    const { data: result, error } = await supabase
      .from('upcoming_visits')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return mapUpcomingVisit(result)
  },

  async deleteUpcomingVisit(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('upcoming_visits')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  async completeUpcomingVisit(id: string): Promise<UpcomingVisit | null> {
    return this.updateUpcomingVisit(id, { status: 'completed' })
  },

  async cancelUpcomingVisit(id: string): Promise<UpcomingVisit | null> {
    return this.updateUpcomingVisit(id, { status: 'cancelled' })
  },

  // Get organization count by plan ID
  async getOrganizationCountByPlan(planId: string): Promise<number> {
    const { data, error } = await supabase
      .from('organizations')
      .select('plan_ids')

    if (error) return 0

    // Count organizations that have this planId in their plan_ids array
    const count = (data || []).filter(org => {
      const planIds = org.plan_ids as string[] | null
      return planIds && planIds.includes(planId)
    }).length

    return count
  },

  // Get organizations by plan ID
  async getOrganizationsByPlan(planId: string): Promise<OrganizationWithDetails[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .contains('plan_ids', [planId])

    if (error) return []

    return (data || []).map(row => ({
      ...mapOrganization(row),
      plans: [],
    }))
  },

  // =====================================================
  // Organization Categories (可自訂機構類型)
  // =====================================================

  async getOrganizationCategories(): Promise<OrganizationCategoryItem[]> {
    const { data, error } = await supabase
      .from('organization_categories')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) return []

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      displayOrder: row.display_order,
      createdAt: row.created_at,
    }))
  },

  async createOrganizationCategory(name: string): Promise<OrganizationCategoryItem | null> {
    // Get max display_order
    const { data: maxData } = await supabase
      .from('organization_categories')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (maxData?.display_order || 0) + 1

    const { data, error } = await supabase
      .from('organization_categories')
      .insert({
        name,
        display_order: nextOrder,
      })
      .select()
      .single()

    if (error) return null

    return {
      id: data.id,
      name: data.name,
      displayOrder: data.display_order,
      createdAt: data.created_at,
    }
  },

  async deleteOrganizationCategory(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('organization_categories')
      .delete()
      .eq('id', id)

    return !error
  },

  // =====================================================
  // Subsidy Records (補助紀錄)
  // =====================================================

  async getSubsidyRecords(organizationId: string): Promise<SubsidyRecord[]> {
    const { data, error } = await supabase
      .from('subsidy_records')
      .select('*')
      .eq('organization_id', organizationId)
      .order('subsidy_date', { ascending: false, nullsFirst: false })

    if (error) throw error
    return (data || []).map(mapSubsidyRecord)
  },

  async createSubsidyRecord(data: Omit<SubsidyRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubsidyRecord> {
    const { data: result, error } = await supabase
      .from('subsidy_records')
      .insert({
        organization_id: data.organizationId,
        subsidy_date: data.subsidyDate,
        subsidy_items: data.subsidyItems,
        subsidy_amount: data.subsidyAmount,
        delivery_method: data.deliveryMethod,
        delivery_status: data.deliveryStatus,
        notes: data.notes,
        created_by: data.createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return mapSubsidyRecord(result)
  },

  async updateSubsidyRecord(id: string, data: Partial<SubsidyRecord>): Promise<SubsidyRecord | null> {
    const updateData: Record<string, unknown> = {}

    if (data.subsidyDate !== undefined) updateData.subsidy_date = data.subsidyDate
    if (data.subsidyItems !== undefined) updateData.subsidy_items = data.subsidyItems
    if (data.subsidyAmount !== undefined) updateData.subsidy_amount = data.subsidyAmount
    if (data.deliveryMethod !== undefined) updateData.delivery_method = data.deliveryMethod
    if (data.deliveryStatus !== undefined) updateData.delivery_status = data.deliveryStatus
    if (data.notes !== undefined) updateData.notes = data.notes

    const { data: result, error } = await supabase
      .from('subsidy_records')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return mapSubsidyRecord(result)
  },

  async deleteSubsidyRecord(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('subsidy_records')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  async getAllSubsidyRecords(): Promise<(SubsidyRecord & { organization?: { id: string; name: string } })[]> {
    const { data, error } = await supabase
      .from('subsidy_records')
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .order('subsidy_date', { ascending: false, nullsFirst: false })

    if (error) throw error
    return (data || []).map(record => ({
      ...mapSubsidyRecord(record),
      organization: record.organizations ? {
        id: record.organizations.id,
        name: record.organizations.name,
      } : undefined,
    }))
  },
}

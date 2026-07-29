import { supabase } from '@/lib/supabase'
import type {
  Organization,
  OrganizationWithDetails,
  VisitRecord,
  VisitRecordWithDetails,
  UpcomingVisit,
  UpcomingVisitWithDetails,
  OrganizationCategory,
  VisitStatus,
  ImageData,
} from '@/types'

// Helper to convert snake_case to camelCase for Organization
function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as OrganizationCategory,
    contactPerson: row.contact_person as string | undefined,
    address: row.address as string | undefined,
    phone: row.phone as string | undefined,
    website: row.website as string | undefined,
    lineId: row.line_id as string | undefined,
    notes: row.notes as string | undefined,
    planIds: (row.plan_ids as string[]) || [],
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
    purpose: row.purpose as string | undefined,
    content: row.content as string | undefined,
    orgRequests: row.org_requests as string | undefined,
    foundationRequests: row.foundation_requests as string | undefined,
    nextSteps: row.next_steps as string | undefined,
    progressUpdate: row.progress_update as string | undefined,
    attachments: (row.attachments as ImageData[]) || [],
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
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fetch all plans to map names
    const { data: allPlans } = await supabase
      .from('plans')
      .select('id, name')

    const plansMap = new Map((allPlans || []).map(p => [p.id, p.name]))

    // Get visit stats for each organization
    const orgs = (data || []).map(row => {
      const org = mapOrganization(row)
      const plans = (org.planIds || [])
        .filter(id => plansMap.has(id))
        .map(id => ({ id, name: plansMap.get(id)! }))
      return {
        ...org,
        plans,
      }
    })

    // Fetch visit counts
    for (const org of orgs) {
      const { count: visitCount } = await supabase
        .from('visit_records')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)

      const { data: lastVisit } = await supabase
        .from('visit_records')
        .select('visit_date')
        .eq('organization_id', org.id)
        .order('visit_date', { ascending: false })
        .limit(1)
        .single()

      const { count: upcomingCount } = await supabase
        .from('upcoming_visits')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('status', 'pending')

      ;(org as OrganizationWithDetails).visitCount = visitCount || 0
      ;(org as OrganizationWithDetails).lastVisitDate = lastVisit?.visit_date
      ;(org as OrganizationWithDetails).upcomingVisitCount = upcomingCount || 0
    }

    return orgs as OrganizationWithDetails[]
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
        contact_person: data.contactPerson,
        address: data.address,
        phone: data.phone,
        website: data.website,
        line_id: data.lineId,
        notes: data.notes,
        plan_ids: data.planIds || [],
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
    if (data.contactPerson !== undefined) updateData.contact_person = data.contactPerson
    if (data.address !== undefined) updateData.address = data.address
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.website !== undefined) updateData.website = data.website
    if (data.lineId !== undefined) updateData.line_id = data.lineId
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.planIds !== undefined) updateData.plan_ids = data.planIds

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

    // Fetch visitor names
    for (const record of records) {
      if (record.visitorIds.length > 0) {
        const { data: visitors } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', record.visitorIds)

        ;(record as VisitRecordWithDetails).visitors = visitors || []
      }
    }

    return records as VisitRecordWithDetails[]
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
        purpose: data.purpose,
        content: data.content,
        org_requests: data.orgRequests,
        foundation_requests: data.foundationRequests,
        next_steps: data.nextSteps,
        progress_update: data.progressUpdate,
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
    if (data.purpose !== undefined) updateData.purpose = data.purpose
    if (data.content !== undefined) updateData.content = data.content
    if (data.orgRequests !== undefined) updateData.org_requests = data.orgRequests
    if (data.foundationRequests !== undefined) updateData.foundation_requests = data.foundationRequests
    if (data.nextSteps !== undefined) updateData.next_steps = data.nextSteps
    if (data.progressUpdate !== undefined) updateData.progress_update = data.progressUpdate
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

    // Fetch assigned user names
    for (const visit of visits) {
      if (visit.assignedUserIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', visit.assignedUserIds)

        ;(visit as UpcomingVisitWithDetails).assignedUsers = users || []
      }
    }

    return visits as UpcomingVisitWithDetails[]
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

    // Fetch assigned user names
    for (const visit of visits) {
      if (visit.assignedUserIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', visit.assignedUserIds)

        ;(visit as UpcomingVisitWithDetails).assignedUsers = users || []
      }
    }

    return visits as UpcomingVisitWithDetails[]
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
}

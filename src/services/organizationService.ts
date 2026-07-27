import type {
  Organization,
  OrganizationWithDetails,
  VisitRecord,
  VisitRecordWithDetails,
  UpcomingVisit,
  UpcomingVisitWithDetails,
} from '@/types'
import { useSupabase } from '@/lib/supabase'
import { supabaseOrganizationService } from './supabase/organizationService'

// Mock data for development
const mockOrganizations: OrganizationWithDetails[] = []
const mockVisitRecords: VisitRecordWithDetails[] = []
const mockUpcomingVisits: UpcomingVisitWithDetails[] = []

const mockOrganizationService = {
  // Organizations
  async getOrganizations(): Promise<OrganizationWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockOrganizations
  },

  async getOrganizationById(id: string): Promise<OrganizationWithDetails | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return mockOrganizations.find(o => o.id === id) || null
  },

  async createOrganization(data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newOrg: OrganizationWithDetails = {
      ...data,
      id: `org-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visitCount: 0,
      upcomingVisitCount: 0,
    }
    mockOrganizations.push(newOrg)
    return newOrg
  },

  async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = mockOrganizations.findIndex(o => o.id === id)
    if (index === -1) return null
    mockOrganizations[index] = {
      ...mockOrganizations[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return mockOrganizations[index]
  },

  async deleteOrganization(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = mockOrganizations.findIndex(o => o.id === id)
    if (index === -1) return false
    mockOrganizations.splice(index, 1)
    return true
  },

  // Visit Records
  async getVisitRecords(organizationId: string): Promise<VisitRecordWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockVisitRecords.filter(r => r.organizationId === organizationId)
  },

  async getVisitRecordById(id: string): Promise<VisitRecordWithDetails | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return mockVisitRecords.find(r => r.id === id) || null
  },

  async createVisitRecord(data: Omit<VisitRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<VisitRecord> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newRecord: VisitRecordWithDetails = {
      ...data,
      id: `visit-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockVisitRecords.push(newRecord)
    return newRecord
  },

  async updateVisitRecord(id: string, data: Partial<VisitRecord>): Promise<VisitRecord | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = mockVisitRecords.findIndex(r => r.id === id)
    if (index === -1) return null
    mockVisitRecords[index] = {
      ...mockVisitRecords[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return mockVisitRecords[index]
  },

  async deleteVisitRecord(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = mockVisitRecords.findIndex(r => r.id === id)
    if (index === -1) return false
    mockVisitRecords.splice(index, 1)
    return true
  },

  // Upcoming Visits
  async getUpcomingVisits(organizationId?: string): Promise<UpcomingVisitWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    if (organizationId) {
      return mockUpcomingVisits.filter(v => v.organizationId === organizationId)
    }
    return mockUpcomingVisits
  },

  async getPendingUpcomingVisits(): Promise<UpcomingVisitWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockUpcomingVisits.filter(v => v.status === 'pending')
  },

  async createUpcomingVisit(data: Omit<UpcomingVisit, 'id' | 'createdAt' | 'updatedAt'>): Promise<UpcomingVisit> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newVisit: UpcomingVisitWithDetails = {
      ...data,
      id: `upcoming-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockUpcomingVisits.push(newVisit)
    return newVisit
  },

  async updateUpcomingVisit(id: string, data: Partial<UpcomingVisit>): Promise<UpcomingVisit | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = mockUpcomingVisits.findIndex(v => v.id === id)
    if (index === -1) return null
    mockUpcomingVisits[index] = {
      ...mockUpcomingVisits[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return mockUpcomingVisits[index]
  },

  async deleteUpcomingVisit(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = mockUpcomingVisits.findIndex(v => v.id === id)
    if (index === -1) return false
    mockUpcomingVisits.splice(index, 1)
    return true
  },

  async completeUpcomingVisit(id: string): Promise<UpcomingVisit | null> {
    return this.updateUpcomingVisit(id, { status: 'completed' })
  },

  async cancelUpcomingVisit(id: string): Promise<UpcomingVisit | null> {
    return this.updateUpcomingVisit(id, { status: 'cancelled' })
  },
}

// Export the appropriate service based on feature flag
export const organizationService = useSupabase ? supabaseOrganizationService : mockOrganizationService

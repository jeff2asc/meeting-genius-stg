"use client"

import { useState, useEffect, useCallback } from 'react'
import { Filter, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from '@/lib/supabase'
import UserCard from "./UserCard"
// Remove CreateUserModal import if it doesn't exist yet

interface UserRow {
  id: number
  name: string
  email: string
  usertype: string
  user_type: string  // Added for UserCard.tsx compatibility
  created_at: string
  assignedpmid: number | null
  companyid: number | null
  company?: { name: string }
  buildings?: string[]
}

interface Building {
  id: number
  name: string
  companyid: number | null
}

interface UsersTabProps {
  currentUser: any
}

export default function UsersTab({ currentUser }: UsersTabProps) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUserType, setFilterUserType] = useState('all')
  const [filterBuilding, setFilterBuilding] = useState('all')
  const [filterCompany, setFilterCompany] = useState<number | null>(null)

  const isMaster = currentUser?.usertype === 'master'

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    try {
      let userQuery = supabase
        .from('users')
        .select(`
          *,
          companies!users_companyid_fkey(name)
        `)
        .order('created_at', { ascending: false })

      if (!isMaster) {
        if (currentUser.usertype === 'corporateadministrator') {
          userQuery = userQuery.eq('companyid', currentUser.companyid)
        } else if (currentUser.usertype === 'propertymanager') {
          userQuery = userQuery.or(`assignedpmid.eq.${currentUser.id},id.eq.${currentUser.id}`)
        }
      }

      const { data: usersData } = await userQuery
      const mappedUsers = (usersData || []).map((user: any) => ({
        ...user,
        user_type: user.usertype // Map for UserCard compatibility
      }))

      let buildingQuery = supabase.from('buildings').select('id, name, companyid')
      if (!isMaster && currentUser.usertype === 'corporateadministrator') {
        buildingQuery = buildingQuery.eq('companyid', currentUser.companyid)
      }
      const { data: buildingsData } = await buildingQuery

      setUsers(mappedUsers)
      setBuildings(buildingsData || [])
    } catch (error) {
      console.error('UsersTab fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [currentUser, isMaster])

  const applyFilters = useCallback(() => {
    let filtered = [...users]

    if (filterUserType !== 'all') {
      filtered = filtered.filter(u => u.usertype === filterUserType)
    }
    if (filterCompany) {
      filtered = filtered.filter(u => u.companyid === filterCompany)
    }
    if (filterBuilding === 'unassigned') {
      filtered = filtered.filter(u => !u.buildings || u.buildings.length === 0)
    }

    setFilteredUsers(filtered)
  }, [users, filterUserType, filterCompany, filterBuilding])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleEditUser = (userId: number) => {
    console.log('Edit user', userId)
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Delete this user?')) return
    
    const { error } = await supabase.from('users').delete().eq('id', userId)
    if (error) {
      alert('Delete failed: ' + error.message)
    } else {
      fetchData()
    }
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">User Management</h2>
            <p className="text-muted-foreground">
              {isMaster ? "Full access to manage all users" : "Manage users assigned to you"}
            </p>
          </div>
          {isMaster && (
            <Button onClick={() => console.log('Create user clicked')}>
              <Plus className="w-4 h-4 mr-2" />
              Create User
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              User Type
            </label>
            <Select value={filterUserType} onValueChange={setFilterUserType}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="master">Master</SelectItem>
                <SelectItem value="corporateadministrator">Corporate Admin</SelectItem>
                <SelectItem value="propertymanager">Property Manager</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="attendee">Attendee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Building
            </label>
            <Select value={filterBuilding} onValueChange={setFilterBuilding}>
              <SelectTrigger>
                <SelectValue placeholder="All Buildings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardContent className="pt-0 pb-6">
          <p className="text-xs text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading users...</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onEdit={() => handleEditUser(user.id)}
              onDelete={() => handleDeleteUser(user.id)}
            />
          ))}
          {filteredUsers.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No users found</CardContent></Card>
          )}
        </div>
      )}
    </>
  )
}

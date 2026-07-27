
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeError } from '@/utils/errorHandler';
import { UserCheck, UserX, Clock, Shield, User, Eye } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  is_active: boolean | null;
  is_approved: boolean;
  created_at: string | null;
  role?: 'owner' | 'admin' | 'user' | 'viewer';
}

const RoleBadge = ({ role }: { role?: string }) => {
  if (role === 'owner') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      <Shield className="h-3 w-3" /> Owner
    </span>
  );
  if (role === 'admin') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      <Shield className="h-3 w-3" /> Admin
    </span>
  );
  if (role === 'viewer') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <Eye className="h-3 w-3" /> Viewer
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      <User className="h-3 w-3" /> User
    </span>
  );
};

const UsersPage = () => {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const fetchProfiles = useCallback(async () => {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const roleMap = new Map<string, Profile['role']>();
    const priority = { owner: 4, admin: 3, viewer: 2, user: 1 } as const;
    (rolesData || []).forEach((r: any) => {
      const role = r.role as NonNullable<Profile['role']>;
      const current = roleMap.get(r.user_id);
      if (!current || (priority[role] ?? 0) > (priority[current as keyof typeof priority] ?? 0)) {
        roleMap.set(r.user_id, role);
      }
    });

    const merged = (profilesData || []).map(p => ({
      ...p,
      role: roleMap.get(p.user_id) ?? 'user',
    }));

    setProfiles(merged);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const toggleActive = async (profile: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: !profile.is_active }).eq('id', profile.id);
    if (error) toast.error(sanitizeError(error));
    else fetchProfiles();
  };

  const approveUser = async (profile: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_approved: true, is_active: true }).eq('id', profile.id);
    if (error) toast.error(sanitizeError(error));
    else { toast.success(`${profile.email} approved`); fetchProfiles(); }
  };

  const rejectUser = async (profile: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_approved: false, is_active: false }).eq('id', profile.id);
    if (error) toast.error(sanitizeError(error));
    else { toast.success(`${profile.email} rejected`); fetchProfiles(); }
  };

  const toggleAdmin = async (profile: Profile) => {
    if (profile.role === 'admin') {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', profile.user_id)
        .eq('role', 'admin');
      if (error) toast.error(sanitizeError(error));
      else { toast.success(`${profile.email} is now a regular user`); fetchProfiles(); }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: profile.user_id, role: 'admin' });
      if (error) toast.error(sanitizeError(error));
      else { toast.success(`${profile.email} promoted to admin`); fetchProfiles(); }
    }
  };

  const toggleViewer = async (profile: Profile) => {
    if (profile.role === 'viewer') {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', profile.user_id)
        .eq('role', 'viewer' as any);
      if (error) toast.error(sanitizeError(error));
      else { toast.success(`${profile.email} viewer removed`); fetchProfiles(); }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: profile.user_id, role: 'viewer' as any });
      if (error) toast.error(sanitizeError(error));
      else { toast.success(`${profile.email} set as viewer`); fetchProfiles(); }
    }
  };

  const pending = profiles.filter(p => !p.is_approved);
  const approved = profiles.filter(p => p.is_approved);
  const activeCount = approved.filter(p => p.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('users')}</h2>
        <p className="text-sm text-muted-foreground">{t('activeUsers')}: {activeCount} / {approved.length}</p>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Pending Approval ({pending.length})
          </h3>
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-start p-3 font-medium text-muted-foreground">#</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('email')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('name')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p, i) => (
                  <tr key={p.id} className="data-table-row">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3">{p.email}</td>
                    <td className="p-3">{p.display_name}</td>
                    <td className="p-3 flex gap-2">
                      <Button size="sm" onClick={() => approveUser(p)}>
                        <UserCheck className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => rejectUser(p)}>
                        <UserX className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approved users */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          Approved Users ({approved.length})
        </h3>
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-start p-3 font-medium text-muted-foreground">#</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('email')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('name')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">Role</th>
                <th className="text-start p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((p, i) => (
                <tr key={p.id} className="data-table-row">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3">{p.email}</td>
                  <td className="p-3">{p.display_name}</td>
                  <td className="p-3"><RoleBadge role={p.role} /></td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {p.is_active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 flex-wrap">
                      {p.role !== 'owner' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => toggleAdmin(p)}>
                            <Shield className="h-3 w-3 mr-1" />
                            {p.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleViewer(p)}>
                            <Eye className="h-3 w-3 mr-1" />
                            {p.role === 'viewer' ? 'Remove Viewer' : 'Make Viewer'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleActive(p)}>
                            {p.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => rejectUser(p)}>
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {approved.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t('noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;




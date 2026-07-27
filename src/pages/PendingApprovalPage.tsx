
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';

const PendingApprovalPage = () => {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Clock className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Awaiting Approval</h1>
          <p className="text-muted-foreground mt-2">
            Your account (<span className="font-medium text-foreground">{user?.email}</span>) is pending approval from the owner.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            You'll be able to access the application once the owner approves your request.
          </p>
        </div>
        <Button variant="outline" onClick={signOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default PendingApprovalPage;




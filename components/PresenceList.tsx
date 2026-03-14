
import React from 'react';
import { Users } from 'lucide-react';

interface PresenceListProps {
    users: any[];
}

const PresenceList: React.FC<PresenceListProps> = ({ users }) => {
    if (users.length <= 1) return null;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex -space-x-2 overflow-hidden">
                {users.map((user, idx) => (
                    <div 
                        key={user.userId} 
                        className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase"
                        title={`${user.userName} (${user.role} - ${user.language})`}
                    >
                        {user.userName?.charAt(0) || '?'}
                    </div>
                ))}
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {users.length} active
            </span>
        </div>
    );
};

export default PresenceList;

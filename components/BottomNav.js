'use client';
import { MessageSquare, Bell, Users, UserCircle } from 'lucide-react';

const TABS = [
  { key: 'chats',    label: 'Chats',    Icon: MessageSquare },
  { key: 'requests', label: 'Requests', Icon: Bell          },
  { key: 'contacts', label: 'Contacts', Icon: Users         },
  { key: 'profile',  label: 'Profile',  Icon: UserCircle    },
];

/**
 * Mobile bottom tab navigation bar.
 * Renders above the Android system navigation bar via padding-bottom: safe-bottom.
 */
export default function BottomNav({ activeTab, onTabChange, requestCount = 0, unreadTotal = 0 }) {
  return (
    <nav
      className="flex-shrink-0 flex bg-[#0a0b15] border-t border-white/8"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map(({ key, label, Icon }) => {
        const isActive = activeTab === key;
        let badge = 0;
        if (key === 'requests') badge = requestCount;
        if (key === 'chats')    badge = unreadTotal;

        return (
          <button
            key={key}
            id={`bottom-tab-${key}`}
            onClick={() => onTabChange(key)}
            className={`
              flex-1 flex flex-col items-center justify-center py-2 gap-0.5
              transition-all active:scale-95 relative
              ${isActive ? 'text-indigo-400' : 'text-gray-500'}
            `}
          >
            {/* Badge */}
            {badge > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-18px)] min-w-[16px] h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center px-1 z-10">
                {badge > 99 ? '99+' : badge}
              </span>
            )}

            {/* Active indicator pill */}
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-indigo-500" />
            )}

            <Icon
              size={22}
              strokeWidth={isActive ? 2.2 : 1.8}
              className={`transition-transform ${isActive ? 'scale-110' : 'scale-100'}`}
            />
            <span className="text-[10px] font-semibold mt-0.5 tracking-wide">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

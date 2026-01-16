/// <reference types="vite/client" />
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useLocation
} from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAazC0NAAj0i87Hq3yVQREAGqdrURvQAig",
  authDomain: "countdown-f25d7.firebaseapp.com",
  projectId: "countdown-f25d7",
  storageBucket: "countdown-f25d7.firebasestorage.app",
  messagingSenderId: "157298631829",
  appId: "1:157298631829:web:0861a0e50bdf7c72bbe79c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/** 
 * TYPES 
 */
type MilestoneStatus = "upcoming" | "active" | "completed";
type IconName =
  | "dashboard"
  | "timer"
  | "settings"
  | "medical_services"
  | "description"
  | "history_edu"
  | "event_available"
  | "check"
  | "task_alt"
  | "add"
  | "edit"
  | "delete"
  | "flag";

interface Milestone {
  id: string;
  title: string;
  description: string;
  location?: string;
  datetimeISO: string;
  icon: IconName;
  imageUrl?: string;
  status: MilestoneStatus;
  createdAt: string;
}

type ThemeMode = "light" | "dark" | "system";
type StoragePersistStatus = "unknown" | "granted" | "denied";

/**
 * UTILS & HOOKS
 */

const STORAGE_KEYS = {
  MILESTONES: "milestones_v1",
  THEME: "theme_pref_v1"
};

const defaultMilestones: Milestone[] = [
  {
    id: '1',
    title: 'Prueba de drogas',
    description: 'Central Clinic Lab',
    datetimeISO: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    icon: 'medical_services',
    imageUrl: '/images/drug-test.svg',
    status: 'upcoming',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Documentación y revisión médica',
    description: 'Sede Principal - Piso 4',
    datetimeISO: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
    icon: 'description',
    imageUrl: '/images/medical-review.svg',
    status: 'upcoming',
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    title: 'Firma',
    description: 'Notaría Central',
    datetimeISO: '2026-02-09T10:00',
    icon: 'history_edu',
    imageUrl: '/images/signing.svg',
    status: 'upcoming',
    createdAt: new Date().toISOString()
  },
  {
    id: '4',
    title: 'Turno',
    description: 'Asignación final',
    datetimeISO: '2026-02-13T08:00',
    icon: 'event_available',
    imageUrl: '/images/appointment.svg',
    status: 'upcoming',
    createdAt: new Date().toISOString()
  }
];

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

function useCountdown(targetDateISO: string) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const target = new Date(targetDateISO).getTime();
  const diff = target - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPast: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, totalMs: diff, isPast: false };
}

const formatDate = (iso: string) => {
  if (!iso) return 'N/A';
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(iso));
};

const fallbackImageUrl = '/images/placeholder.svg';
const getMilestoneImage = (milestone: Milestone) =>
  milestone.imageUrl || fallbackImageUrl;

const normalizeMilestone = (input: Partial<Milestone>): Milestone => ({
  id: input.id || Date.now().toString(),
  title: input.title || 'Nuevo hito',
  description: input.description || '',
  datetimeISO: input.datetimeISO || '',
  icon: (input.icon || 'flag') as IconName,
  imageUrl: input.imageUrl || fallbackImageUrl,
  status: (input.status || 'upcoming') as MilestoneStatus,
  createdAt: input.createdAt || new Date().toISOString()
});

const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const Icon = ({ name, className }: { name: IconName; className?: string }) => {
  const shared = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...shared} className={className}>
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="3" width="8" height="8" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
      );
    case "timer":
      return (
        <svg {...shared} className={className}>
          <circle cx="12" cy="13" r="8" />
          <path d="M9 3h6" />
          <path d="M12 9v4l3 2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...shared} className={className}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1" />
        </svg>
      );
    case "medical_services":
      return (
        <svg {...shared} className={className}>
          <path d="M12 5v14M5 12h14" />
          <rect x="4" y="4" width="16" height="16" rx="4" />
        </svg>
      );
    case "description":
      return (
        <svg {...shared} className={className}>
          <path d="M7 3h7l5 5v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      );
    case "history_edu":
      return (
        <svg {...shared} className={className}>
          <path d="M3 21l3-1 11-11-2-2-11 11-1 3z" />
          <path d="M14 4l2 2" />
        </svg>
      );
    case "event_available":
      return (
        <svg {...shared} className={className}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M8 2v4M16 2v4M3 10h18" />
          <path d="M8 16l2 2 4-4" />
        </svg>
      );
    case "check":
      return (
        <svg {...shared} className={className}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "task_alt":
      return (
        <svg {...shared} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l2 2 4-4" />
        </svg>
      );
    case "add":
      return (
        <svg {...shared} className={className}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "edit":
      return (
        <svg {...shared} className={className}>
          <path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25z" />
          <path d="M14.05 6.2l3.75 3.75" />
        </svg>
      );
    case "delete":
      return (
        <svg {...shared} className={className}>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <rect x="6" y="6" width="12" height="14" rx="2" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      );
    case "flag":
      return (
        <svg {...shared} className={className}>
          <path d="M5 3v18" />
          <path d="M5 4h10l-2 4 2 4H5" />
        </svg>
      );
    default:
      return null;
  }
};

/**
 * COMPONENTS
 */

// Fix: Make children optional to avoid missing property error
const ThemeProvider = ({ children }: { children?: React.ReactNode }) => {
  const [theme] = useLocalStorage<ThemeMode>(STORAGE_KEYS.THEME, "system");

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (mode: ThemeMode) => {
      root.classList.remove("light", "dark");
      if (mode === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(mode);
      }
    };

    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-[#1A1C1E] text-[#1A1C1E] dark:text-[#E2E2E6] transition-colors duration-300">
      {children}
    </div>
  );
};

// Fix: Make children optional to avoid missing property error
const ProgressCircle = ({
  percentage,
  children,
  size = 256,
  strokeWidth = 10,
  color = "#D84315",
  darkColor = "#FF8A65"
}: {
  percentage: number,
  children?: React.ReactNode,
  size?: number,
  strokeWidth?: number,
  color?: string,
  darkColor?: string
}) => {
  const radius = (size / 2) - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center mx-auto" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="50%" cy="50%" r={radius}
          className="stroke-current text-gray-200 dark:text-gray-800"
          strokeWidth={strokeWidth} fill="transparent"
        />
        <circle
          cx="50%" cy="50%" r={radius}
          className="transition-all duration-1000 ease-out"
          style={{ stroke: color }}
          strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
};

// Fix: Make children optional to avoid missing property error
const Layout = ({ children }: { children?: React.ReactNode }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: 'dashboard', label: 'Dashboard' },
    { path: '/focus', icon: 'timer', label: 'Focus' },
    { path: '/settings', icon: 'settings', label: 'Settings' }
  ];

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative pb-24">
      <main className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 dark:bg-[#1A1C1E]/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex justify-around items-center z-50 rounded-t-3xl shadow-lg">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-1 transition-colors ${location.pathname === item.path ? 'text-[#D84315]' : 'text-gray-400'
              }`}
            aria-label={item.label}
          >
            <Icon name={item.icon as IconName} className="w-6 h-6" />
            <span className="text-[10px] font-medium uppercase tracking-widest">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

const MilestoneCircle = ({ milestone }: { milestone: Milestone }) => {
  const { days, hours, minutes, seconds, isPast, totalMs } = useCountdown(milestone.datetimeISO);

  const percentage = useMemo(() => {
    const start = new Date(milestone.createdAt).getTime();
    const end = new Date(milestone.datetimeISO).getTime();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = total - totalMs;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [milestone, totalMs]);

  return (
    <ProgressCircle
      percentage={percentage}
      size={40}
      strokeWidth={3}
      color={isPast ? "#FF8A65" : "#D84315"}
    >
      <Icon
        name={milestone.status === 'completed' ? 'check' : milestone.icon}
        className={`w-4 h-4 ${milestone.status === 'completed' ? 'text-green-500' : ''}`}
      />
    </ProgressCircle>
  );
};

const CountdownDisplay = ({ targetDate }: { targetDate: string }) => {
  const { days, hours, minutes, seconds, isPast } = useCountdown(targetDate);

  if (isPast) return <span className="text-[#FF8A65] font-bold">VENCIDO</span>;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col">
        <span className="text-2xl font-bold">{String(days).padStart(2, '0')}</span>
        <span className="text-[10px] uppercase text-gray-400">Days</span>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold">{String(hours).padStart(2, '0')}</span>
        <span className="text-[10px] uppercase text-gray-400">Hrs</span>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold">{String(minutes).padStart(2, '0')}</span>
        <span className="text-[10px] uppercase text-gray-400">Min</span>
      </div>
    </div>
  );
};

const Dashboard = ({ milestones, toggleComplete }: { milestones: Milestone[], toggleComplete: (id: string) => void }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sortedTimeline = useMemo(() => {
    return [...milestones].sort((a, b) => new Date(a.datetimeISO).getTime() - new Date(b.datetimeISO).getTime());
  }, [milestones]);

  const activeMilestone = useMemo(() => {
    const future = sortedTimeline.filter(m => m.status !== 'completed' && new Date(m.datetimeISO).getTime() > now);
    return future[0] || null;
  }, [sortedTimeline, now]);

  const stats = useMemo(() => {
    if (milestones.length === 0) return { total: 0, completed: 0, percentage: 0, lastDate: null };

    const sortedByCreated = [...milestones].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const lastEvent = sortedTimeline[sortedTimeline.length - 1];

    const startTime = new Date(sortedByCreated[0].createdAt).getTime();
    const endTime = new Date(lastEvent.datetimeISO).getTime();
    const totalDuration = endTime - startTime;

    let percentage = 0;
    if (totalDuration > 0) {
      const elapsed = now - startTime;
      percentage = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    } else {
      percentage = 100;
    }

    return {
      total: milestones.length,
      completed: milestones.filter(m => m.status === 'completed').length,
      percentage,
      lastDate: lastEvent.datetimeISO
    };
  }, [milestones, sortedTimeline, now]);

  return (
    <div className="space-y-8 animate-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1C1E] dark:text-white">Timeline</h1>
          {stats.lastDate && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Meta: {formatDate(stats.lastDate)}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-[#D84315]">{stats.percentage}%</span>
          <p className="text-[10px] uppercase font-bold tracking-tighter text-gray-400">Completed</p>
        </div>
      </header>

      <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#D84315] transition-all duration-1000"
          style={{ width: `${stats.percentage}%` }}
        />
      </div>

      {activeMilestone && (
        <div className="bg-[#1A1C1E] dark:bg-[#2A2C2E] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
          <img
            src={getMilestoneImage(activeMilestone)}
            alt={activeMilestone.title}
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/70" />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <Icon name={activeMilestone.icon} className="w-8 h-8 text-[#FF8A65]" />
              <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Next</span>
            </div>
            <h2 className="text-xl font-bold mb-1">{activeMilestone.title}</h2>
            <p className="text-gray-400 text-sm mb-6">{activeMilestone.description}</p>
            <CountdownDisplay targetDate={activeMilestone.datetimeISO} />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">Milestones</h3>
        {sortedTimeline.map((m) => (
          <div key={m.id} className="flex gap-4 items-start group">
            <div className="flex flex-col items-center">
              <button
                onClick={() => toggleComplete(m.id)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${m.status === 'completed'
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-white dark:bg-[#1A1C1E]'
                  }`}
              >
                <MilestoneCircle milestone={m} />
              </button>
              <div className="w-px h-12 bg-gray-200 dark:bg-gray-800 group-last:hidden" />
            </div>
            <div className="flex-1 pt-1">
              <div className="relative h-24 w-full overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 mb-2">
                <img
                  src={getMilestoneImage(m)}
                  alt={m.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex justify-between items-start">
                <h4 className={`font-bold ${m.status === 'completed' ? 'text-gray-400 line-through' : ''}`}>
                  {m.title}
                </h4>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-gray-400">{formatDate(m.datetimeISO)}</div>
                  <div className="text-[10px] font-bold text-[#D84315]">
                    {useCountdown(m.datetimeISO).isPast ? 'VENCIDO' : `${useCountdown(m.datetimeISO).days}d left`}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{m.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Focus = ({ milestones }: { milestones: Milestone[] }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeMilestone = useMemo(() => {
    return milestones
      .filter(m => m.status !== 'completed' && new Date(m.datetimeISO).getTime() > now)
      .sort((a, b) => new Date(a.datetimeISO).getTime() - new Date(b.datetimeISO).getTime())[0];
  }, [milestones, now]);

  const { days, hours, minutes, seconds, isPast, totalMs } = useCountdown(activeMilestone?.datetimeISO || '');

  const percentage = useMemo(() => {
    if (!activeMilestone) return 100;
    const start = new Date(activeMilestone.createdAt).getTime();
    const end = new Date(activeMilestone.datetimeISO).getTime();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = total - totalMs;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [activeMilestone, totalMs]);

  if (!activeMilestone) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-4 text-center">
        <Icon name="task_alt" className="w-16 h-16 text-gray-300" />
        <h2 className="text-xl font-bold">All caught up!</h2>
        <p className="text-gray-500">No pending milestones.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center space-y-12 animate-in pt-8">
      <div className="text-center">
        <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#D84315] mb-2">Focused On</p>
        <h2 className="text-3xl font-bold">{activeMilestone.title}</h2>
      </div>

      <ProgressCircle percentage={percentage}>
        <div className="flex flex-col items-center">
          <span className="text-6xl font-black tracking-tighter leading-none">
            {isPast ? '00' : String(days).padStart(2, '0')}
          </span>
          <span className="text-xs uppercase font-bold tracking-[0.2em] text-gray-400 mt-2">Days Left</span>
        </div>
      </ProgressCircle>

      <div className="grid grid-cols-3 gap-12 w-full max-w-[280px]">
        <div className="text-center">
          <p className="text-2xl font-bold leading-none">{isPast ? '00' : String(hours).padStart(2, '0')}</p>
          <p className="text-[10px] uppercase text-gray-400 font-bold mt-1">Hrs</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold leading-none">{isPast ? '00' : String(minutes).padStart(2, '0')}</p>
          <p className="text-[10px] uppercase text-gray-400 font-bold mt-1">Min</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold leading-none">{isPast ? '00' : String(seconds).padStart(2, '0')}</p>
          <p className="text-[10px] uppercase text-gray-400 font-bold mt-1">Sec</p>
        </div>
      </div>
    </div>
  );
};

const Settings = ({ milestones, setMilestones, theme, setTheme }: {
  milestones: Milestone[],
  setMilestones: (m: Milestone[] | ((prev: Milestone[]) => Milestone[])) => void,
  theme: ThemeMode,
  setTheme: (t: ThemeMode) => void
}) => {
  const [isEditing, setIsEditing] = useState<Milestone | null>(null);
  const [persistStatus, setPersistStatus] = useState<StoragePersistStatus>("unknown");

  useEffect(() => {
    const requestPersist = async () => {
      if (!navigator.storage || !navigator.storage.persist) {
        setPersistStatus("denied");
        return;
      }
      const granted = await navigator.storage.persist();
      setPersistStatus(granted ? "granted" : "denied");
    };
    requestPersist();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;

    try {
      // Create a copy without the id to avoid saving the Firestore ID inside the document
      const { id, ...milestoneData } = isEditing;

      if (milestones.find(m => m.id === id)) {
        const milestoneDoc = doc(db, 'milestones', id);
        await updateDoc(milestoneDoc, milestoneData);
      } else {
        await addDoc(collection(db, 'milestones'), milestoneData);
      }
      setIsEditing(null);
    } catch (error) {
      console.error("Error saving milestone:", error);
      alert("Error al guardar el hito. Verifica tu conexión o permisos.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este hito?')) {
      try {
        await deleteDoc(doc(db, 'milestones', id));
      } catch (error) {
        console.error("Error deleting milestone:", error);
        alert("Error al eliminar el hito.");
      }
    }
  };

  const handleExport = () => {
    downloadJson('milestones-backup.json', { milestones });
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const data = Array.isArray(parsed) ? parsed : parsed?.milestones;
      if (!Array.isArray(data)) throw new Error('Invalid data');
      const normalized = data.map((item: Partial<Milestone>) => normalizeMilestone(item));

      // Batch add to Firestore
      for (const m of normalized) {
        await addDoc(collection(db, 'milestones'), { ...m });
      }
      alert('Importación completada con éxito.');
    } catch (error) {
      console.error("Error importing milestones:", error);
      alert('No se pudo importar el archivo. Verifica que sea un backup válido.');
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <header>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 text-sm">Customization & data</p>
      </header>

      <section className="bg-white dark:bg-[#2A2C2E] p-6 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Theme</h3>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeMode)}
          className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm font-medium border-none outline-none focus:ring-2 focus:ring-[#D84315]"
        >
          <option value="system">System Default</option>
          <option value="light">Light Mode</option>
          <option value="dark">Dark Mode</option>
        </select>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Storage persistence: {persistStatus === "granted" ? "enabled" : "not granted"}
        </p>
      </section>

      <section className="bg-white dark:bg-[#2A2C2E] p-6 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Backup</h3>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 bg-gray-100 dark:bg-gray-800 py-3 rounded-xl font-bold text-sm"
          >
            Export Data
          </button>
          <label className="flex-1 bg-[#D84315] text-white py-3 rounded-xl font-bold text-sm text-center cursor-pointer">
            Import Data
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Milestones</h3>
          <button
            onClick={() => setIsEditing({
              id: Date.now().toString(),
              title: '',
              description: '',
              datetimeISO: '',
              icon: 'flag',
              imageUrl: fallbackImageUrl,
              status: 'upcoming',
              createdAt: new Date().toISOString()
            })}
            className="text-[#D84315] text-xs font-bold flex items-center gap-1"
          >
            <Icon name="add" className="w-4 h-4" /> Add New
          </button>
        </div>

        <div className="space-y-3">
          {milestones.map(m => (
            <div key={m.id} className="bg-white dark:bg-[#2A2C2E] p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  src={getMilestoneImage(m)}
                  alt={m.title}
                  className="w-11 h-11 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
                />
                <Icon name={m.icon} className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="truncate">
                  <h4 className="font-bold text-sm truncate">{m.title}</h4>
                  <p className="text-[10px] text-gray-500 uppercase">{formatDate(m.datetimeISO)}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setIsEditing(m)} className="p-2 text-blue-500 rounded-lg">
                  <Icon name="edit" className="w-5 h-5" />
                </button>
                <button onClick={() => handleDelete(m.id)} className="p-2 text-red-500 rounded-lg">
                  <Icon name="delete" className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {isEditing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#1A1C1E] w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in">
            <h2 className="text-2xl font-bold mb-6">Edit Milestone</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                required
                value={isEditing.title}
                onChange={e => setIsEditing({ ...isEditing, title: e.target.value })}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 outline-none"
                placeholder="Title"
              />
              <input
                value={isEditing.description}
                onChange={e => setIsEditing({ ...isEditing, description: e.target.value })}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 outline-none"
                placeholder="Description"
              />
              <input
                value={isEditing.imageUrl || ''}
                onChange={e => setIsEditing({ ...isEditing, imageUrl: e.target.value })}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 outline-none"
                placeholder="Ruta imagen (ej: /images/signing.svg)"
              />
              <p className="text-[10px] text-gray-400 px-2 mt-[-8px]">
                Imágenes disponibles: signing.svg, medical-review.svg, drug-test.svg, appointment.svg, placeholder.svg
              </p>
              <input
                required
                type="datetime-local"
                value={isEditing.datetimeISO}
                onChange={e => setIsEditing({ ...isEditing, datetimeISO: e.target.value })}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 outline-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsEditing(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 py-3 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#D84315] text-white py-3 rounded-xl font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [theme, setTheme] = useLocalStorage<ThemeMode>(STORAGE_KEYS.THEME, "system");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Subscribe to Firestore immediately
    const q = query(collection(db, 'milestones'), orderBy('datetimeISO', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Milestone[];
      setMilestones(ms);
      setLoading(false);
    }, (err) => {
      console.error("Firestore snapshot error:", err);
      // Only set error if we don't have any milestones yet (persistent cache might have some)
      setError("Error de permisos o de conexión con Firebase. Revisa las reglas de seguridad.");
      setLoading(false);
    });

    // 2. Background migration (non-blocking)
    const handleMigration = async () => {
      const migrationFlag = localStorage.getItem('firebase_migrated_v_final_3');
      if (!migrationFlag) {
        const localData = localStorage.getItem(STORAGE_KEYS.MILESTONES);
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log("Iniciando migración de datos locales...");
              for (const m of parsed) {
                const { id, ...data } = m;
                await addDoc(collection(db, 'milestones'), data);
              }
              console.log("Migración completada con éxito.");
            }
          } catch (e) {
            console.error("Migration error:", e);
          }
        }
        localStorage.setItem('firebase_migrated_v_final_3', 'true');
      }
    };
    handleMigration();

    return () => unsubscribe();
  }, []);

  const toggleComplete = useCallback(async (id: string) => {
    const milestone = milestones.find(m => m.id === id);
    if (!milestone) return;

    try {
      const milestoneDoc = doc(db, 'milestones', id);
      await updateDoc(milestoneDoc, {
        status: milestone.status === 'completed' ? 'upcoming' : 'completed'
      });
    } catch (error) {
      console.error("Error toggling completion:", error);
    }
  }, [milestones]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] dark:bg-[#1A1C1E]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#D84315] border-t-transparent rounded-full animate-spin" />
          <div className="text-[#D84315] font-bold animate-pulse">Cargando eventos...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#FDFCFB] dark:bg-[#1A1C1E] text-center">
        <Icon name="timer" className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-xl font-bold mb-2">Ups, algo ha salido mal</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[#D84315] text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-[#D84315]/20"
        >
          Reintentar conexión
        </button>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard milestones={milestones} toggleComplete={toggleComplete} />} />
            <Route path="/focus" element={<Focus milestones={milestones} />} />
            <Route path="/settings" element={
              <Settings
                milestones={milestones}
                setMilestones={setMilestones}
                theme={theme}
                setTheme={setTheme}
              />
            } />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

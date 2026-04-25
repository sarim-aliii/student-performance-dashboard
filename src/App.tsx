import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import Papa from 'papaparse';
import { 
  Upload, Download, Filter, TrendingUp, Users, Award, 
  LayoutDashboard, LogIn, LogOut, FileSpreadsheet, BrainCircuit, Loader2, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Share2, HelpCircle, BookOpen, Lightbulb
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";

// GSAP Imports
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType, registerWithEmail, loginWithEmail } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, addDoc, query, where, updateDoc, doc } from 'firebase/firestore';
import { format, isWithinInterval, parseISO } from 'date-fns';

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Search, Mail} from 'lucide-react';

// Register GSAP Plugin
gsap.registerPlugin(useGSAP);

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface StudentRecord {
  id?: string;
  studentId: string;
  name: string;
  class: string;
  semester: string;
  subject: string;
  marks: number;
  attendance: number;
  tags?: string[];
  uploadedAt: string;
  uploadedBy: string;
}

interface ReportConfig {
  id?: string;
  userId: string;
  email: string;
  frequency: 'weekly' | 'monthly';
  active: boolean;
  lastSent?: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

// --- Components ---

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: any }) => (
  <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden", className)}>
    {(title || Icon) && (
      <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-indigo-500" />}
          {title}
        </h3>
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

const StatCard = ({ title, value, subValue, icon: Icon, trend }: { title: string, value: string | number, subValue?: string, icon: any, trend?: { value: string, positive: boolean } }) => (
  <Card className="gsap-stat-card flex-1 hover:shadow-md transition-shadow duration-300">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
        {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
        {trend && (
          <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", trend.positive ? "text-emerald-600" : "text-rose-600")}>
            <TrendingUp className={cn("w-3 h-3", !trend.positive && "rotate-180")} />
            {trend.value}
          </div>
        )}
      </div>
      <div className="p-3 bg-indigo-50 rounded-xl">
        <Icon className="w-6 h-6 text-indigo-600" />
      </div>
    </div>
  </Card>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Refs for GSAP
  const containerRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);

  // Filters
  const [filterClass, setFilterClass] = useState<string>('All');
  const [filterSubject, setFilterSubject] = useState<string>('All');
  const [filterSemester, setFilterSemester] = useState<string>('All');
  const [searchStudentId, setSearchStudentId] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Reporting
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof StudentRecord; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setReportConfig(null);
      return;
    }

    const q = query(collection(db, 'students'), where('uploadedBy', '==', user.uid));
    const unsubscribeRecords = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentRecord));
      setRecords(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const rq = query(collection(db, 'reportConfigs'), where('userId', '==', user.uid));
    const unsubscribeReport = onSnapshot(rq, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setReportConfig({ id: doc.id, ...doc.data() } as ReportConfig);
      } else {
        setReportConfig(null);
      }
    });

    return () => {
      unsubscribeRecords();
      unsubscribeReport();
    };
  }, [user]);

  // --- GSAP Animations ---
  useGSAP(() => {
    if (loading) return;

    if (!user && loginRef.current) {
      // Login form entrance
      gsap.from(loginRef.current, { 
        y: 40, opacity: 0, duration: 0.8, ease: 'back.out(1.2)' 
      });
    }

    if (user && containerRef.current) {
      // Dashboard sequential entrance
      const tl = gsap.timeline();
      
      tl.from('.gsap-header-el', {
        y: -20, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out'
      })
      .from('.gsap-filters', {
        y: 20, opacity: 0, duration: 0.5, ease: 'power2.out'
      }, "-=0.3")
      .from('.gsap-stat-card', {
        y: 30, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'back.out(1.2)'
      }, "-=0.2")
      .from('.gsap-chart', {
        scale: 0.95, opacity: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out'
      }, "-=0.4");
    }
  }, { dependencies: [user, loading], scope: containerRef });

  // AI Panel Smooth Reveal
  useGSAP(() => {
    if (aiInsight && aiPanelRef.current) {
      gsap.fromTo(aiPanelRef.current, 
        { height: 0, opacity: 0, overflow: 'hidden' },
        { height: 'auto', opacity: 1, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, { dependencies: [aiInsight] });

  // Table Row Filtering Animation
  useGSAP(() => {
    if (user && containerRef.current) {
      gsap.fromTo('.gsap-table-row', 
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, { dependencies: [records, filterClass, filterSubject, filterSemester, searchStudentId, dateRange, selectedTags, sortConfig], scope: containerRef });

  // --- Derived Data ---
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    records.forEach(r => r.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [records]);

  const filteredRecords = useMemo(() => {
    const filtered = records.filter(r => {
      const matchClass = filterClass === 'All' || r.class === filterClass;
      const matchSubject = filterSubject === 'All' || r.subject === filterSubject;
      const matchSemester = filterSemester === 'All' || r.semester === filterSemester;
      const matchStudentId = !searchStudentId || r.studentId.toLowerCase().includes(searchStudentId.toLowerCase());
      
      let matchDate = true;
      if (dateRange.from && dateRange.to) {
        const recordDate = parseISO(r.uploadedAt);
        matchDate = isWithinInterval(recordDate, { start: dateRange.from, end: dateRange.to });
      }

      const matchTags = selectedTags.length === 0 || selectedTags.every(t => r.tags?.includes(t));

      return matchClass && matchSubject && matchSemester && matchStudentId && matchDate && matchTags;
    });

    if (sortConfig) {
      return [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === undefined || bValue === undefined) return 0;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [records, filterClass, filterSubject, filterSemester, searchStudentId, dateRange, selectedTags, sortConfig]);

  const handleSort = (key: keyof StudentRecord) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof StudentRecord) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-indigo-600" /> : <ArrowDown className="w-3 h-3 ml-1 text-indigo-600" />;
  };

  const handleShareRecord = (record: StudentRecord) => {
    const text = `Student Record:
ID: ${record.studentId}
Name: ${record.name}
Subject: ${record.subject}
Marks: ${record.marks}%
Attendance: ${record.attendance}%
Status: ${record.marks >= 40 ? 'Pass' : 'Fail'}`;

    navigator.clipboard.writeText(text).then(() => {
      toast.success("Record details copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy record details.");
    });
  };

  const stats = useMemo(() => {
    if (filteredRecords.length === 0) return { avgMarks: 0, avgAttendance: 0, totalStudents: 0, topPerformer: 'N/A' };
    
    const totalMarks = filteredRecords.reduce((acc, r) => acc + r.marks, 0);
    const totalAttendance = filteredRecords.reduce((acc, r) => acc + r.attendance, 0);
    const uniqueStudents = new Set(filteredRecords.map(r => r.studentId)).size;
    
    const studentAverages = filteredRecords.reduce((acc, r) => {
      if (!acc[r.name]) acc[r.name] = { total: 0, count: 0 };
      acc[r.name].total += r.marks;
      acc[r.name].count += 1;
      return acc;
    }, {} as Record<string, { total: number, count: number }>);

    let topName = 'N/A';
    let topAvg = 0;
    Object.entries(studentAverages).forEach(([name, data]) => {
      const avg = data.total / data.count;
      if (avg > topAvg) {
        topAvg = avg;
        topName = name;
      }
    });

    return {
      avgMarks: Math.round(totalMarks / filteredRecords.length),
      avgAttendance: Math.round(totalAttendance / filteredRecords.length),
      totalStudents: uniqueStudents,
      topPerformer: topName
    };
  }, [filteredRecords]);

  const subjectData = useMemo(() => {
    const subjects = filteredRecords.reduce((acc, r) => {
      if (!acc[r.subject]) acc[r.subject] = { name: r.subject, marks: 0, count: 0 };
      acc[r.subject].marks += r.marks;
      acc[r.subject].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(subjects).map(s => ({
      name: s.name,
      avg: Math.round(s.marks / s.count)
    })).sort((a, b) => b.avg - a.avg);
  }, [filteredRecords]);

  const performanceDistribution = useMemo(() => {
    const ranges = [
      { name: '90-100', count: 0 },
      { name: '80-89', count: 0 },
      { name: '70-79', count: 0 },
      { name: '60-69', count: 0 },
      { name: 'Below 60', count: 0 },
    ];

    filteredRecords.forEach(r => {
      if (r.marks >= 90) ranges[0].count++;
      else if (r.marks >= 80) ranges[1].count++;
      else if (r.marks >= 70) ranges[2].count++;
      else if (r.marks >= 60) ranges[3].count++;
      else ranges[4].count++;
    });

    return ranges;
  }, [filteredRecords]);

  const attendanceTrendData = useMemo(() => {
    const dailyData = filteredRecords.reduce((acc, r) => {
      const date = format(parseISO(r.uploadedAt), 'MMM dd');
      if (!acc[date]) acc[date] = { date, attendance: 0, count: 0 };
      acc[date].attendance += r.attendance;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { date: string, attendance: number, count: number }>);

    return Object.values(dailyData).map(d => ({
      date: d.date,
      avg: Math.round(d.attendance / d.count)
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredRecords]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const promises = results.data.map((row: any) => {
            const record: StudentRecord = {
              studentId: row.studentId || row['Student ID'] || 'N/A',
              name: row.name || row['Name'] || 'Unknown',
              class: row.class || row['Class'] || 'N/A',
              semester: row.semester || row['Semester'] || 'N/A',
              subject: row.subject || row['Subject'] || 'N/A',
              marks: parseFloat(row.marks || row['Marks'] || 0),
              attendance: parseFloat(row.attendance || row['Attendance'] || 0),
              tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
              uploadedAt: new Date().toISOString(),
              uploadedBy: user.uid
            };
            return addDoc(collection(db, 'students'), record);
          });
          await Promise.all(promises);
          toast.success(`Successfully uploaded ${promises.length} records.`);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'students');
        } finally {
          setUploading(false);
          e.target.value = '';
        }
      }
    });
  };

  const saveReportConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const config = {
      userId: user.uid,
      email: formData.get('email') as string,
      frequency: formData.get('frequency') as 'weekly' | 'monthly',
      active: formData.get('active') === 'on',
    };

    try {
      if (reportConfig?.id) {
        await updateDoc(doc(db, 'reportConfigs', reportConfig.id), config);
      } else {
        await addDoc(collection(db, 'reportConfigs'), config);
      }
      toast.success("Report settings saved successfully!");
      setIsReportDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save report settings.");
    }
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records to export.");
      return;
    }

    const csv = Papa.unparse(filteredRecords.map(({ id, uploadedBy, ...rest }) => rest));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `student_records_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully!");
  };

  const generateAiInsights = async () => {
    if (filteredRecords.length === 0) return;
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this student performance data and provide 3 key insights and 2 recommendations. 
        Data Summary:
        - Average Marks: ${stats.avgMarks}
        - Average Attendance: ${stats.avgAttendance}
        - Top Performer: ${stats.topPerformer}
        - Subject Performance: ${JSON.stringify(subjectData)}
        
        Format the response in clean Markdown.`
      });
      const response = await model;
      setAiInsight(response.text || "No insights generated.");
    } catch (error) {
      console.error("AI Insight Error:", error);
      setAiInsight("Failed to generate insights. Please check your API key.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* 1. LOADING STATE */}
      {loading ? (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) 
      
      /* 2. AUTH / LOGIN STATE */
      : !user ? (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <div 
            ref={loginRef}
            className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100 opacity-0"
          >
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <LayoutDashboard className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">Student Analytics</h1>
            <p className="text-slate-500 mb-8 text-center">Manage student performance data and get AI-powered insights.</p>
            
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  try {
                    await loginWithEmail(formData.get('email') as string, formData.get('password') as string);
                  } catch (err: any) {
                    toast.error(err.message);
                  }
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="name@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" required />
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">Login</Button>
                </form>
              </TabsContent>
              <TabsContent value="register">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  try {
                    await registerWithEmail(formData.get('email') as string, formData.get('password') as string);
                  } catch (err: any) {
                    toast.error(err.message);
                  }
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" name="email" type="email" placeholder="name@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input id="reg-password" name="password" type="password" required />
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">Register</Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500">Or continue with</span></div>
            </div>

            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  await loginWithGoogle();
                } catch (err: any) {
                  if (err.code !== 'auth/popup-closed-by-user') {
                    toast.error(err.message);
                  }
                }
              }}
              className="w-full py-6 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all"
            >
              <LogIn className="w-5 h-5" />
              Google Login
            </Button>
          </div>
          <Toaster />
        </div>
      ) 
      
      /* 3. MAIN DASHBOARD STATE */
      : (
        <>
          <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 gsap-header-el">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                    <LayoutDashboard className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">EduAnalytics</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
                    <DialogTrigger render={<Button variant="ghost" size="icon" className="text-slate-500 hover:text-indigo-600" />}>
                      <HelpCircle className="w-5 h-5" />
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-indigo-600" />
                          Dashboard Guide & FAQ
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                        <section className="space-y-3">
                          <h4 className="font-bold text-slate-900 flex items-center gap-2">
                            <Upload className="w-4 h-4 text-indigo-500" />
                            How to Upload Data?
                          </h4>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            Click the <span className="font-semibold text-indigo-600">"Upload CSV"</span> button in the dashboard overview. 
                            Your CSV should include columns for Student ID, Name, Class, Semester, Subject, Marks, and Attendance. 
                            Once uploaded, the dashboard will automatically refresh with your data.
                          </p>
                        </section>

                        <section className="space-y-3">
                          <h4 className="font-bold text-slate-900 flex items-center gap-2">
                            <Filter className="w-4 h-4 text-indigo-500" />
                            Using Filters & Search
                          </h4>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            Use the <span className="font-semibold text-indigo-600">Advanced Filters</span> section to narrow down records. 
                            You can filter by Student ID, Date Range, Class, Subject, and Semester. 
                            Charts and statistics will update in real-time based on your selection.
                          </p>
                        </section>

                        <section className="space-y-3">
                          <h4 className="font-bold text-slate-900 flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4 text-indigo-500" />
                            Interpreting AI Insights
                          </h4>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            Click <span className="font-semibold text-indigo-600">"AI Insights"</span> to generate a summary of current performance. 
                            The AI analyzes average marks, attendance, and subject-wise trends to provide actionable recommendations.
                          </p>
                        </section>

                        <section className="space-y-3">
                          <h4 className="font-bold text-slate-900 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-indigo-500" />
                            Pro Tips
                          </h4>
                          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
                            <li>Click table headers to sort records by specific columns.</li>
                            <li>Use the "Share" icon in the table to quickly copy student details.</li>
                            <li>Export your filtered view at any time using the "Export CSV" button.</li>
                            <li>Set up automated reports via the mail icon in the top navigation.</li>
                          </ul>
                        </section>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                    <DialogTrigger render={<Button variant="ghost" size="icon" className="text-slate-500 hover:text-indigo-600" />}>
                      <Mail className="w-5 h-5" />
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Automated Reporting</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={saveReportConfig} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="report-email">Recipient Email</Label>
                          <Input id="report-email" name="email" type="email" defaultValue={reportConfig?.email || user.email || ''} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="frequency">Frequency</Label>
                          <Select name="frequency" defaultValue={reportConfig?.frequency || 'weekly'}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="active" name="active" defaultChecked={reportConfig?.active ?? true} />
                          <Label htmlFor="active">Enable automated reports</Label>
                        </div>
                        <Button type="submit" className="w-full">Save Configuration</Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-slate-700">{user.displayName || user.email}</span>
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 gsap-header-el">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
                <p className="text-slate-500">Track and analyze student performance metrics.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <label className="relative cursor-pointer group">
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <div className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm",
                    uploading ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md"
                  )}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : 'Upload CSV'}
                  </div>
                </label>
                
                <button 
                  onClick={generateAiInsights}
                  disabled={aiLoading || records.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4 text-indigo-500" />}
                  AI Insights
                </button>

                <Button 
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={filteredRecords.length === 0}
                  className="flex items-center gap-2 px-5 py-6 rounded-xl font-semibold transition-all shadow-sm"
                >
                  <Download className="w-4 h-4 text-emerald-500" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-8 space-y-6 gsap-filters">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  Advanced Filters
                </h3>
                <Button variant="ghost" size="sm" onClick={() => {
                  setFilterClass('All');
                  setFilterSubject('All');
                  setFilterSemester('All');
                  setSearchStudentId('');
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedTags([]);
                }} className="text-xs text-slate-500">Reset Filters</Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Student ID</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search ID..." 
                      value={searchStudentId}
                      onChange={(e) => setSearchStudentId(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Date Range</Label>
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" className="w-full justify-start text-left font-normal" />}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from}
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Class</Label>
                  <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Classes</SelectItem>
                      {[...new Set(records.map(r => r.class))].sort().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Subject</Label>
                  <Select value={filterSubject} onValueChange={setFilterSubject}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Subjects</SelectItem>
                      {[...new Set(records.map(r => r.subject))].sort().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Semester</Label>
                  <Select value={filterSemester} onValueChange={setFilterSemester}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Semesters</SelectItem>
                      {[...new Set(records.map(r => r.semester))].sort().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Filter by Tags</Label>
                <div className="flex flex-wrap gap-1">
                    {allTags.map(tag => (
                      <Badge 
                        key={tag} 
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      >
                        {tag}
                      </Badge>
                    ))}
                    {allTags.length === 0 && <span className="text-xs text-slate-400 italic">No tags found</span>}
                  </div>
                </div>
              </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard 
                title="Avg. Marks" 
                value={`${stats.avgMarks}%`} 
                icon={Award} 
                trend={{ value: 'Above avg', positive: stats.avgMarks > 75 }}
              />
              <StatCard 
                title="Avg. Attendance" 
                value={`${stats.avgAttendance}%`} 
                icon={Users} 
                trend={{ value: 'Healthy', positive: stats.avgAttendance > 80 }}
              />
              <StatCard 
                title="Total Students" 
                value={stats.totalStudents} 
                icon={Users} 
              />
              <StatCard 
                title="Top Performer" 
                value={stats.topPerformer} 
                icon={Award} 
              />
            </div>

            {/* AI Insight Panel */}
            {aiInsight && (
              <div ref={aiPanelRef} className="mb-8">
                <Card title="AI Performance Insights" icon={BrainCircuit} className="bg-indigo-50/50 border-indigo-100">
                  <div className="prose prose-slate max-w-none prose-sm">
                    <ReactMarkdown>{aiInsight}</ReactMarkdown>
                  </div>
                  <button 
                    onClick={() => {
                      gsap.to(aiPanelRef.current, {
                        height: 0, opacity: 0, duration: 0.3, ease: 'power2.in',
                        onComplete: () => setAiInsight(null)
                      });
                    }}
                    className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Dismiss Insights
                  </button>
                </Card>
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="gsap-chart">
                <Card title="Subject-wise Performance" icon={TrendingUp}>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart data={subjectData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        <Bar 
                          dataKey="avg" 
                          fill="#6366f1" 
                          radius={[6, 6, 0, 0]} 
                          barSize={40}
                          animationDuration={1000}
                          animationEasing="ease-in-out"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="gsap-chart">
                <Card title="Grade Distribution" icon={Award}>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie
                          data={performanceDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="count"
                          animationDuration={1000}
                          animationEasing="ease-in-out"
                        >
                          {performanceDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 mb-8 gsap-chart">
              <Card title="Attendance Trends Over Time" icon={TrendingUp}>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={attendanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} unit="%" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="avg" 
                        stroke="#6366f1" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Recent Records Table */}
            <div className="gsap-chart">
              <Card title="Student Records" icon={FileSpreadsheet}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th 
                          className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => handleSort('studentId')}
                        >
                          <div className="flex items-center">
                            Student ID {getSortIcon('studentId')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center">
                            Name {getSortIcon('name')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => handleSort('subject')}
                        >
                          <div className="flex items-center">
                            Subject {getSortIcon('subject')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => handleSort('marks')}
                        >
                          <div className="flex items-center">
                            Marks {getSortIcon('marks')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => handleSort('attendance')}
                        >
                          <div className="flex items-center">
                            Attendance {getSortIcon('attendance')}
                          </div>
                        </th>
                        <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredRecords.slice(0, 10).map((record) => (
                        <tr key={record.id} className="gsap-table-row hover:bg-slate-50 transition-colors group">
                          <td className="px-4 py-4 text-sm font-medium text-slate-600">{record.studentId}</td>
                          <td className="px-4 py-4 text-sm font-bold text-slate-900">{record.name}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            <div className="flex flex-col">
                              <span>{record.subject}</span>
                              <div className="flex gap-1 mt-1">
                                {record.tags?.map(t => <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">{t}</Badge>)}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-slate-900">{record.marks}%</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{record.attendance}%</td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              record.marks >= 40 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            )}>
                              {record.marks >= 40 ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                              onClick={() => handleShareRecord(record)}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredRecords.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">
                            No records found. Upload a CSV to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredRecords.length > 10 && (
                  <div className="mt-6 flex items-center justify-center">
                    <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      View all {filteredRecords.length} records <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </Card>
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-12 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <LayoutDashboard className="w-5 h-5 text-indigo-600" />
                <span className="text-lg font-bold">EduAnalytics</span>
              </div>
              <p className="text-slate-500 text-sm">© 2026 Student Performance Analytics Dashboard.</p>
            </div>
          </footer>
          <Toaster />
        </>
      )}
    </div>
  );
}
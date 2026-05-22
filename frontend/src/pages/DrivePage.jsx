import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedNavbar from '../components/SharedNavbar';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import { useAuth } from '../context/AuthContext';
import driveLogo from "/assets/google-drive.png";
import { useBackgroundTasks } from '../context/BackgroundTasksContext';

import {
  Folder as FolderIcon,
  Search,
  Plus,
  ChevronRight,
  Home,
  RotateCw,
  Trash2,
  CheckCircle,
  ExternalLink,
  ScanLine,
  FileSearch,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  Archive,
  File,
  FileCode,
  Music,
  Video,
  Database,
  Menu,
  X,
} from 'lucide-react';

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const getTheme = (dark) => ({
  bgPage: dark ? '#0F172A' : 'transparent',
  bgSidebar: dark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.82)',
  bgTopbar: dark ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.84)',
  bgCard: dark ? '#1E293B' : '#FFFFFF',
  bgCardHover: dark ? '#243044' : '#FFF5F9',
  bgSecondary: dark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
  bgInput: dark ? 'rgba(255,255,255,0.06)' : 'rgba(249,95,158,0.04)',
  bgTag: dark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
  border: dark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
  borderCard: dark ? 'rgba(255,255,255,0.09)' : '#EAF0F7',
  borderCardHov: 'rgba(249,95,158,0.50)',
  textPrimary: dark ? '#F1F5F9' : '#0F172A',
  textSecondary: dark ? '#94A3B8' : '#64748B',
  textMuted: dark ? '#64748B' : '#94A3B8',
  shadow: dark ? '0 2px 10px rgba(0,0,0,0.35)' : '0 1px 5px rgba(0,0,0,0.06)',
  shadowHov: dark ? '0 8px 32px rgba(249,95,158,0.20)' : '0 8px 28px rgba(249,95,158,0.15)',
  scanBarBg: dark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
  codeBlock: dark ? 'rgba(255,255,255,0.07)' : '#F8FAFC',
  resultHeader: dark ? 'rgba(255,255,255,0.015)' : 'rgba(249,95,158,0.015)',
  folderActive: dark ? 'rgba(249,95,158,0.11)' : 'rgba(249,95,158,0.06)',
  folderHov: dark ? 'rgba(255,255,255,0.04)' : 'rgba(249,95,158,0.035)',
  scanDisabled: dark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
});

// ─── File type definitions with rich metadata ──────────────────────────────────
const FILE_TYPES = {
  pdf: {
    color: '#EF4444',
    gradient: 'linear-gradient(135deg,#EF4444,#F87171)',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.25)',
    label: 'PDF',
    iconType: 'pdf',
  },
  doc: {
    color: '#2563EB',
    gradient: 'linear-gradient(135deg,#2563EB,#60A5FA)',
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.25)',
    label: 'DOC',
    iconType: 'doc',
  },
  docx: {
    color: '#2563EB',
    gradient: 'linear-gradient(135deg,#2563EB,#60A5FA)',
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.25)',
    label: 'DOCX',
    iconType: 'doc',
  },
  xls: {
    color: '#16A34A',
    gradient: 'linear-gradient(135deg,#16A34A,#4ADE80)',
    bg: 'rgba(22,163,74,0.12)',
    border: 'rgba(22,163,74,0.25)',
    label: 'XLS',
    iconType: 'sheet',
  },
  xlsx: {
    color: '#16A34A',
    gradient: 'linear-gradient(135deg,#16A34A,#4ADE80)',
    bg: 'rgba(22,163,74,0.12)',
    border: 'rgba(22,163,74,0.25)',
    label: 'XLSX',
    iconType: 'sheet',
  },
  csv: {
    color: '#059669',
    gradient: 'linear-gradient(135deg,#059669,#34D399)',
    bg: 'rgba(5,150,105,0.12)',
    border: 'rgba(5,150,105,0.25)',
    label: 'CSV',
    iconType: 'sheet',
  },
  ppt: {
    color: '#EA580C',
    gradient: 'linear-gradient(135deg,#EA580C,#FB923C)',
    bg: 'rgba(234,88,12,0.12)',
    border: 'rgba(234,88,12,0.25)',
    label: 'PPT',
    iconType: 'ppt',
  },
  pptx: {
    color: '#EA580C',
    gradient: 'linear-gradient(135deg,#EA580C,#FB923C)',
    bg: 'rgba(234,88,12,0.12)',
    border: 'rgba(234,88,12,0.25)',
    label: 'PPTX',
    iconType: 'ppt',
  },
  png: {
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
    bg: 'rgba(124,58,237,0.12)',
    border: 'rgba(124,58,237,0.25)',
    label: 'PNG',
    iconType: 'image',
  },
  jpg: {
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
    bg: 'rgba(124,58,237,0.12)',
    border: 'rgba(124,58,237,0.25)',
    label: 'JPG',
    iconType: 'image',
  },
  jpeg: {
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
    bg: 'rgba(124,58,237,0.12)',
    border: 'rgba(124,58,237,0.25)',
    label: 'JPEG',
    iconType: 'image',
  },
  gif: {
    color: '#9333EA',
    gradient: 'linear-gradient(135deg,#9333EA,#C084FC)',
    bg: 'rgba(147,51,234,0.12)',
    border: 'rgba(147,51,234,0.25)',
    label: 'GIF',
    iconType: 'image',
  },
  svg: {
    color: '#0EA5E9',
    gradient: 'linear-gradient(135deg,#0EA5E9,#38BDF8)',
    bg: 'rgba(14,165,233,0.12)',
    border: 'rgba(14,165,233,0.25)',
    label: 'SVG',
    iconType: 'image',
  },
  webp: {
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
    bg: 'rgba(124,58,237,0.12)',
    border: 'rgba(124,58,237,0.25)',
    label: 'WEBP',
    iconType: 'image',
  },
  zip: {
    color: '#0891B2',
    gradient: 'linear-gradient(135deg,#0891B2,#22D3EE)',
    bg: 'rgba(8,145,178,0.12)',
    border: 'rgba(8,145,178,0.25)',
    label: 'ZIP',
    iconType: 'archive',
  },
  rar: {
    color: '#0891B2',
    gradient: 'linear-gradient(135deg,#0891B2,#22D3EE)',
    bg: 'rgba(8,145,178,0.12)',
    border: 'rgba(8,145,178,0.25)',
    label: 'RAR',
    iconType: 'archive',
  },
  tar: {
    color: '#0891B2',
    gradient: 'linear-gradient(135deg,#0891B2,#22D3EE)',
    bg: 'rgba(8,145,178,0.12)',
    border: 'rgba(8,145,178,0.25)',
    label: 'TAR',
    iconType: 'archive',
  },
  txt: {
    color: '#64748B',
    gradient: 'linear-gradient(135deg,#64748B,#94A3B8)',
    bg: 'rgba(100,116,139,0.12)',
    border: 'rgba(100,116,139,0.25)',
    label: 'TXT',
    iconType: 'text',
  },
  md: {
    color: '#475569',
    gradient: 'linear-gradient(135deg,#475569,#94A3B8)',
    bg: 'rgba(71,85,105,0.12)',
    border: 'rgba(71,85,105,0.25)',
    label: 'MD',
    iconType: 'text',
  },
  js: {
    color: '#CA8A04',
    gradient: 'linear-gradient(135deg,#CA8A04,#FDE047)',
    bg: 'rgba(202,138,4,0.12)',
    border: 'rgba(202,138,4,0.25)',
    label: 'JS',
    iconType: 'code',
  },
  ts: {
    color: '#2563EB',
    gradient: 'linear-gradient(135deg,#2563EB,#60A5FA)',
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.25)',
    label: 'TS',
    iconType: 'code',
  },
  py: {
    color: '#2563EB',
    gradient: 'linear-gradient(135deg,#2563EB,#34D399)',
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.25)',
    label: 'PY',
    iconType: 'code',
  },
  json: {
    color: '#D97706',
    gradient: 'linear-gradient(135deg,#D97706,#FCD34D)',
    bg: 'rgba(217,119,6,0.12)',
    border: 'rgba(217,119,6,0.25)',
    label: 'JSON',
    iconType: 'code',
  },
  mp3: {
    color: '#EC4899',
    gradient: 'linear-gradient(135deg,#EC4899,#F9A8D4)',
    bg: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.25)',
    label: 'MP3',
    iconType: 'audio',
  },
  mp4: {
    color: '#6D28D9',
    gradient: 'linear-gradient(135deg,#6D28D9,#A78BFA)',
    bg: 'rgba(109,40,217,0.12)',
    border: 'rgba(109,40,217,0.25)',
    label: 'MP4',
    iconType: 'video',
  },
  default: {
    color: '#94A3B8',
    gradient: 'linear-gradient(135deg,#94A3B8,#CBD5E1)',
    bg: 'rgba(148,163,184,0.12)',
    border: 'rgba(148,163,184,0.25)',
    label: 'FILE',
    iconType: 'file',
  },
};

// ─── Sidebar folder type icons ─────────────────────────────────────────────────
const SIDEBAR_FOLDER_ICONS = {
  reports: { color: '#EF4444', bg: 'rgba(239,68,68,0.14)', icon: 'pdf' },
  report: { color: '#EF4444', bg: 'rgba(239,68,68,0.14)', icon: 'pdf' },
  documents: { color: '#2563EB', bg: 'rgba(37,99,235,0.14)', icon: 'doc' },
  document: { color: '#2563EB', bg: 'rgba(37,99,235,0.14)', icon: 'doc' },
  docs: { color: '#2563EB', bg: 'rgba(37,99,235,0.14)', icon: 'doc' },
  spreadsheets: { color: '#16A34A', bg: 'rgba(22,163,74,0.14)', icon: 'sheet' },
  spreadsheet: { color: '#16A34A', bg: 'rgba(22,163,74,0.14)', icon: 'sheet' },
  sheets: { color: '#16A34A', bg: 'rgba(22,163,74,0.14)', icon: 'sheet' },
  presentations: { color: '#EA580C', bg: 'rgba(234,88,12,0.14)', icon: 'ppt' },
  presentation: { color: '#EA580C', bg: 'rgba(234,88,12,0.14)', icon: 'ppt' },
  slides: { color: '#EA580C', bg: 'rgba(234,88,12,0.14)', icon: 'ppt' },
  images: { color: '#7C3AED', bg: 'rgba(124,58,237,0.14)', icon: 'image' },
  image: { color: '#7C3AED', bg: 'rgba(124,58,237,0.14)', icon: 'image' },
  photos: { color: '#7C3AED', bg: 'rgba(124,58,237,0.14)', icon: 'image' },
  media: { color: '#7C3AED', bg: 'rgba(124,58,237,0.14)', icon: 'image' },
  archives: { color: '#0891B2', bg: 'rgba(8,145,178,0.14)', icon: 'archive' },
  archive: { color: '#0891B2', bg: 'rgba(8,145,178,0.14)', icon: 'archive' },
  videos: { color: '#6D28D9', bg: 'rgba(109,40,217,0.14)', icon: 'video' },
  video: { color: '#6D28D9', bg: 'rgba(109,40,217,0.14)', icon: 'video' },
  audio: { color: '#EC4899', bg: 'rgba(236,72,153,0.14)', icon: 'audio' },
  music: { color: '#EC4899', bg: 'rgba(236,72,153,0.14)', icon: 'audio' },
  code: { color: '#CA8A04', bg: 'rgba(202,138,4,0.14)', icon: 'code' },
  scripts: { color: '#CA8A04', bg: 'rgba(202,138,4,0.14)', icon: 'code' },
  data: { color: '#059669', bg: 'rgba(5,150,105,0.14)', icon: 'database' },
  database: { color: '#059669', bg: 'rgba(5,150,105,0.14)', icon: 'database' },
  misc: { color: '#64748B', bg: 'rgba(100,116,139,0.14)', icon: 'folder' },
  other: { color: '#64748B', bg: 'rgba(100,116,139,0.14)', icon: 'folder' },
  default: { color: '#F95F9E', bg: 'rgba(249,95,158,0.14)', icon: 'folder' },
};

// ─── SVG Icon Components for file types ───────────────────────────────────────
const FileTypeIcon = ({ type, color, size = 26 }) => {
  const s = size;
  switch (type) {
    case 'pdf':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.18" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <text x="5" y="19" fontSize="5.5" fontWeight="800" fill={color} fontFamily="sans-serif" letterSpacing="-0.3">PDF</text>
        </svg>
      );
    case 'doc':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.18" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 13h8M8 17h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'sheet':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
          <path d="M3 9h18M3 15h18M9 3v18" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
          <rect x="9" y="9" width="12" height="6" fill={color} opacity="0.12" />
        </svg>
      );
    case 'ppt':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="14" rx="2" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
          <path d="M9 8h6M7 12h10M10 20l2-2 2 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="10" r="2" fill={color} opacity="0.3" />
        </svg>
      );
    case 'image':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="2" fill={color} opacity="0.5" />
          <path d="M21 15l-5-5L5 21" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 13l3 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'archive':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M21 8H3M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8M21 8l-2-5H5L3 8" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M10 12h4M12 12v4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'code':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 13l-2 2 2 2M15 13l2 2-2 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'audio':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="10" cy="16" r="2" stroke={color} strokeWidth="1.3" />
          <path d="M12 14V10l5-1v4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'video':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 12l5 3-5 3V12z" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
        </svg>
      );
    case 'database':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="7" rx="9" ry="3" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5" />
          <path d="M3 7v10c0 1.657 4.03 3 9 3s9-1.343 9-3V7" stroke={color} strokeWidth="1.5" />
          <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case 'text':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 11h8M8 14h8M8 17h5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
  }
};

// Folder icon for sidebar
const SidebarFolderIcon = ({ iconType, color, size = 17 }) => {
  const s = size;
  switch (iconType) {
    case 'pdf':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.25" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <text x="5" y="20" fontSize="5.5" fontWeight="800" fill={color} fontFamily="sans-serif">PDF</text>
        </svg>
      );
    case 'doc':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={color} opacity="0.25" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M14 2v6h6" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 13h8M8 17h5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'sheet':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2.5" fill={color} opacity="0.2" stroke={color} strokeWidth="2" />
          <path d="M3 9h18M3 15h18M9 3v18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'ppt':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="14" rx="2.5" fill={color} opacity="0.2" stroke={color} strokeWidth="2" />
          <path d="M12 22v-4M8 22h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M7 10h5a2 2 0 1 1 0 4H7V8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'image':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2.5" fill={color} opacity="0.2" stroke={color} strokeWidth="2" />
          <circle cx="8.5" cy="8.5" r="2" fill={color} opacity="0.6" />
          <path d="M21 15l-5-5L5 21" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'archive':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M21 8H3M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8M21 8l-2-5H5L3 8" fill={color} opacity="0.2" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M10 12h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'video':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2.5" fill={color} opacity="0.2" stroke={color} strokeWidth="2" />
          <path d="M10 9l6 3.5L10 16V9z" fill={color} stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'audio':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" fill={color} opacity="0.2" stroke={color} strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill={color} opacity="0.5" />
          <path d="M12 3a9 9 0 0 1 6 2.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'code':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'database':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="7" rx="9" ry="3" fill={color} opacity="0.3" stroke={color} strokeWidth="2" />
          <path d="M3 7v10c0 1.657 4.03 3 9 3s9-1.343 9-3V7" stroke={color} strokeWidth="2" />
          <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" stroke={color} strokeWidth="1.8" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" fill={color} opacity="0.25" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getFileTypeInfo = (mime, fileName) => {
  // Try extension from filename first
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext && FILE_TYPES[ext]) return FILE_TYPES[ext];
  }
  if (!mime) return FILE_TYPES.default;
  if (mime.includes('pdf')) return FILE_TYPES.pdf;
  if (mime.includes('word') || mime.includes('document')) return FILE_TYPES.docx;
  if (mime.includes('sheet') || mime.includes('excel')) return FILE_TYPES.xlsx;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return FILE_TYPES.pptx;
  if (mime.includes('image/png')) return FILE_TYPES.png;
  if (mime.includes('image/gif')) return FILE_TYPES.gif;
  if (mime.includes('image/svg')) return FILE_TYPES.svg;
  if (mime.includes('image')) return FILE_TYPES.jpg;
  if (mime.includes('zip') || mime.includes('archive') || mime.includes('compressed')) return FILE_TYPES.zip;
  if (mime.includes('audio')) return FILE_TYPES.mp3;
  if (mime.includes('video')) return FILE_TYPES.mp4;
  if (mime.includes('text/csv')) return FILE_TYPES.csv;
  if (mime.includes('javascript')) return FILE_TYPES.js;
  if (mime.includes('typescript')) return FILE_TYPES.ts;
  if (mime.includes('python')) return FILE_TYPES.py;
  if (mime.includes('json')) return FILE_TYPES.json;
  if (mime.includes('text')) return FILE_TYPES.txt;
  return FILE_TYPES.default;
};

const getSidebarIconInfo = (folderName) => {
  if (!folderName) return SIDEBAR_FOLDER_ICONS.default;
  const key = folderName.toLowerCase().trim();
  return SIDEBAR_FOLDER_ICONS[key] || SIDEBAR_FOLDER_ICONS.default;
};

const fmtSize = (size) => {
  if (!size) return '';
  const b = parseInt(size);
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

// ─── Highlight ────────────────────────────────────────────────────────────────
const HighlightText = ({ text, query }) => {
  if (!query || !text) return <span>{text}</span>;
  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  );
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: 'rgba(249,95,158,0.25)', color: 'inherit', borderRadius: '3px', padding: '0 2px' }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
};

// ─── FileCard ─────────────────────────────────────────────────────────────────
const FileCard = ({ file, searchQuery, theme, indexedDriveFileIds, backgroundDocuments, indexDriveFile, retryDriveFileIndex }) => {
  const [hov, setHov] = useState(false);
  const typeInfo = getFileTypeInfo(file.mimeType, file.name);
  const fullPath = file.full_path || file.folderPath || 'NEXORA';

  const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt'];
  const ext = file.name?.split('.').pop()?.toLowerCase();
  const isIndexable = ALLOWED_EXTENSIONS.includes(ext);

  const bgDoc = backgroundDocuments ? backgroundDocuments.find(d => d.id === file.id) : null;
  const bgStatus = bgDoc ? bgDoc.status : null;
  const isIndexed = (indexedDriveFileIds && indexedDriveFileIds.has(file.id)) || bgStatus === 'Indexed';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? theme.bgCardHover : theme.bgCard,
        border: `1.5px solid ${hov ? typeInfo.color + '55' : theme.borderCard}`,
        borderRadius: '18px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
        cursor: 'default',
        boxShadow: hov
          ? `0 8px 28px ${typeInfo.color}22, 0 2px 8px rgba(0,0,0,0.06)`
          : theme.shadow,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Colored top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: hov ? typeInfo.gradient : 'transparent',
        borderRadius: '18px 18px 0 0',
        transition: 'background 0.22s',
      }} />

      {/* Subtle bg glow on hover */}
      {hov && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '80px',
          background: `linear-gradient(180deg, ${typeInfo.color}08 0%, transparent 100%)`,
          borderRadius: '18px 18px 0 0',
          pointerEvents: 'none',
        }} />
      )}

      {/* Icon + Extension Badge Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* File icon box */}
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: typeInfo.bg,
          border: `1.5px solid ${typeInfo.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transform: hov ? 'scale(1.07) rotate(-2deg)' : 'scale(1) rotate(0deg)',
          transition: 'transform 0.22s cubic-bezier(.34,1.56,.64,1)',
          boxShadow: hov ? `0 4px 16px ${typeInfo.color}28` : 'none',
        }}>
          <FileTypeIcon type={typeInfo.iconType} color={typeInfo.color} size={28} />
        </div>

        {/* Extension badges row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {isIndexable && (
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#F95F9E',
              background: 'rgba(249, 95, 158, 0.12)',
              border: '1.5px solid rgba(249, 95, 158, 0.25)',
              padding: '3px 10px',
              borderRadius: '99px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              lineHeight: 1.4,
            }}>
              ✨ Indexable
            </span>
          )}
          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.09em',
            color: typeInfo.color,
            background: typeInfo.bg,
            border: `1.5px solid ${typeInfo.border}`,
            padding: '3px 10px',
            borderRadius: '99px',
            display: 'block',
            lineHeight: 1.4,
          }}>
            {typeInfo.label}
          </span>
        </div>
      </div>

      {/* File name */}
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: theme.textPrimary,
        lineHeight: '1.45',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        transition: 'color 0.15s',
      }}>
        <HighlightText text={file.name} query={searchQuery} />
      </div>

      {/* Full path */}
      <div style={{
        fontSize: '11px',
        color: theme.textSecondary,
        lineHeight: '1.55',
        wordBreak: 'break-all',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '5px',
      }}>
        <FolderOpen size={11} style={{ marginTop: '2px', flexShrink: 0, color: '#F95F9E', opacity: 0.75 }} />
        <span><HighlightText text={fullPath} query={searchQuery} /></span>
      </div>

      {/* Divider */}
      <div style={{
        height: '1px',
        margin: '0 -2px',
        background: hov ? `${typeInfo.color}28` : theme.border,
        transition: 'background 0.2s',
      }} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {file.size && (
            <span style={{
              fontSize: '11px',
              color: theme.textSecondary,
              background: theme.bgTag,
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 500,
            }}>
              {fmtSize(file.size)}
            </span>
          )}
          {(file.modifiedTime || file.createdTime) && (
            <span style={{ fontSize: '11px', color: theme.textMuted }}>
              {fmtDate(file.modifiedTime || file.createdTime)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(file.webViewLink || file.drive_web_link) && (
            <button
              onClick={() => window.open(file.webViewLink || file.drive_web_link, '_blank')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: typeInfo.color,
                background: hov ? `${typeInfo.color}1a` : `${typeInfo.color}0f`,
                border: `1px solid ${typeInfo.border}`,
                borderRadius: '8px',
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              <ExternalLink size={10} /> Drive
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── DrivePage ────────────────────────────────────────────────────────────────
export default function DrivePage() {
  const { isDarkMode } = useTheme();
  const theme = getTheme(isDarkMode);
  const t = theme; // alias used in JSX below
  const { confirm } = useDialog();
  const navigate = useNavigate();
  const { token } = useAuth();

  const {
    backgroundDocuments,
    indexedDriveFileIds,
    deepScanState,
    startPersistentDeepScan,
    stopDeepScanPolling,
    indexDriveFile,
    retryDriveFileIndex,
    indexDriveFolder,
    driveConnected,
    setDriveConnected,
    myDriveFolders,
    setMyDriveFolders,
    myDriveFiles,
    setMyDriveFiles,
    myDriveLoading,
    myDriveError,
    currentFolderId,
    setCurrentFolderId,
    folderBreadcrumb,
    setFolderBreadcrumb,
    loadMyDrive,
    handleFolderClick: ctxHandleFolderClick,
    handleBreadcrumbClick: ctxHandleBreadcrumbClick,
    checkDriveConnection,
  } = useBackgroundTasks();

  const { scanStatus, scanProgress, scannedFiles, scanJobId, backendStatus } = deepScanState;

  // ── helpers ────────────────────────────────────────────────────────
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const authFetch = async (url, opts = {}) => {
    const activeToken = token || localStorage.getItem('nexora_token');
    return fetch(`${BASE}${url}`, {
      ...opts,
      headers: { Authorization: `Bearer ${activeToken}`, ...(opts.headers || {}) },
    });
  };

  // ── OAuth / connection state ────────────────────────────────────────
  const [connectLoading, setConnectLoading] = useState(false);

  // ── Other UI state ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hoveredFolder, setHoveredFolder] = useState(null);
  const [viewMode, setViewMode] = useState('myDrive'); // myDrive | scan
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);

  const pollRef = useRef(null);

  // ── On mount: handle OAuth redirect param check if any ──────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justConnected = params.get('connected') === 'true';
    if (justConnected) {
      window.history.replaceState({}, '', window.location.pathname);
      checkDriveConnection();
    }
    return () => {
      stopDeepScanPolling();
    };
  }, []);

  useEffect(() => {
    setVisibleCount(60);
  }, [searchQuery, viewMode]);

  // ── OAuth connect ──────────────────────────────────────────────────
  const handleConnectDrive = async () => {
    setConnectLoading(true);
    try {
      const res = await authFetch('/api/drive/oauth/auth-url');
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch {
      setConnectLoading(false);
    }
  };

  // ── OAuth disconnect ───────────────────────────────────────────────
  const handleDisconnectDrive = async () => {
    const ok = await confirm('Disconnect your Google Drive from NEXORA?');
    if (!ok) return;
    try {
      await authFetch('/api/drive/disconnect', { method: 'DELETE' });
      setDriveConnected(false);
      setMyDriveFolders([]);
      setMyDriveFiles([]);
      setFolderBreadcrumb([{ id: 'root', name: 'My Drive' }]);
      sessionStorage.removeItem('nexora_my_scan_files');
      sessionStorage.removeItem('nexora_my_scan_status');
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  // ── Folder navigation (My Drive browser) ──────────────────────────
  const handleFolderClick = (folder) => {
    ctxHandleFolderClick(folder);
    setViewMode('myDrive');
    setMobileSidebarOpen(false);
    setVisibleCount(60);
  };

  const handleBreadcrumbClick = (crumb, index) => {
    ctxHandleBreadcrumbClick(crumb, index);
    setViewMode('myDrive');
    setMobileSidebarOpen(false);
    setVisibleCount(60);
  };

  // ── Deep Scan (user's own drive) ───────────────────────────────────
  const handleDeepScan = () => {
    setViewMode('scan');
    startPersistentDeepScan();
    setMobileSidebarOpen(false);
    setVisibleCount(60);
  };

  // ── Search filter ──────────────────────────────────────────────────
  const flashSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const displayFiles = (viewMode === 'scan' ? scannedFiles : myDriveFiles).filter(f =>
    !searchQuery ||
    f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.full_path || f.folderPath || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <div
      className="app-background flex flex-col h-screen"
      style={{ fontFamily: '"Inter",sans-serif', color: t.textPrimary, transition: 'color 0.2s' }}
    >
      <SharedNavbar />

      {/* Keep all existing keyframes + scrollbar styles */}
      {/* Keep all existing keyframes + scrollbar styles */}
      <style>{`
        @keyframes spin          { to { transform: rotate(360deg); } }
        @keyframes fadeUp        { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes indeterminate { 0% { transform:translateX(-100%); width:35%; } 100% { transform:translateX(320%); width:35%; } }
        .drive-sb::-webkit-scrollbar        { width:4px; }
        .drive-sb::-webkit-scrollbar-track  { background:transparent; }
        .drive-sb::-webkit-scrollbar-thumb  { background:rgba(249,95,158,0.28); border-radius:99px; }
        .drive-search:focus { outline:none; border-color:#F95F9E !important; box-shadow:0 0 0 3px rgba(249,95,158,0.14); }
        .drive-search::placeholder, .drive-folder-input::placeholder { color:#94A3B8; }
        .scan-btn:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 6px 22px rgba(249,95,158,0.42) !important; }
        .file-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; padding:20px; animation:fadeUp .22s ease both; }
        .sb-folder-row:hover .sb-delete-btn { opacity:1 !important; }
        
        /* Mobile Slide-Over Sidebar Drawer & FAB styling */
        @media (max-width: 1023px) {
          .drive-sidebar-container {
            position: fixed !important;
            top: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            height: 100vh !important;
            z-index: 1000 !important;
            transform: translateX(-100%);
            box-shadow: 8px 0 32px rgba(0,0,0,0.3) !important;
            width: 280px !important;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .drive-sidebar-container.open {
            transform: translateX(0) !important;
          }
          .mobile-sidebar-fab {
            display: flex !important;
          }
        }
        
        /* Responsiveness for all 5 breakpoints */
        /* Breakpoint 1: Mobile Small (<375px) */
        @media (max-width: 374px) {
          .file-grid {
            grid-template-columns: 1fr !important;
            padding: 10px !important;
            gap: 12px !important;
          }
          .drive-topbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            padding: 10px 14px !important;
          }
          .drive-topbar-search {
            width: 100% !important;
          }
        }
        
        /* Breakpoint 2: Mobile Medium (375px - 425px) */
        @media (min-width: 375px) and (max-width: 424px) {
          .file-grid {
            grid-template-columns: 1fr !important;
            padding: 12px !important;
            gap: 14px !important;
          }
          .drive-topbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            padding: 12px 16px !important;
          }
          .drive-topbar-search {
            width: 100% !important;
          }
        }
        
        /* Breakpoint 3: Mobile Large (425px - 768px) */
        @media (min-width: 425px) and (max-width: 767px) {
          .file-grid {
            grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)) !important;
            padding: 14px !important;
            gap: 14px !important;
          }
          .drive-topbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            padding: 12px 16px !important;
          }
          .drive-topbar-search {
            width: 100% !important;
          }
        }
        
        /* Breakpoint 4: Tablet (768px - 1024px) */
        @media (min-width: 768px) and (max-width: 1023px) {
          .file-grid {
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important;
            padding: 16px !important;
            gap: 16px !important;
          }
          .drive-topbar {
            gap: 12px !important;
            padding: 12px 20px !important;
          }
        }
        
        /* Breakpoint 5: Desktop (>=1024px) */
        @media (min-width: 1024px) {
          .mobile-sidebar-fab {
            display: none !important;
          }
        }
      `}</style>

      {/* ── CHECKING STATE ───────────────────────────────────────────── */}
      {driveConnected === null && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', flexDirection: 'column', gap: '14px',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            border: '3px solid rgba(249,95,158,0.18)',
            borderTop: '3px solid #F95F9E',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: t.textSecondary, fontSize: '14px' }}>
            Checking Drive connection…
          </span>
        </div>
      )}

      {/* ── NOT CONNECTED — Full screen connect card ──────────────────── */}
      {driveConnected === false && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flex: 1, padding: '24px', paddingTop: '108px',
        }}>
          <div style={{
            background: isDarkMode ? '#1E293B' : '#FFFFFF',
            border: '1.5px solid rgba(249,95,158,0.22)',
            borderRadius: '24px', padding: '48px 40px',
            maxWidth: '460px', width: '100%', textAlign: 'center',
            boxShadow: '0 8px 48px rgba(249,95,158,0.10)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
          }}>
            <img src="/assets/google-drive.png" alt="Google Drive"
              style={{ width: '64px', height: '64px' }} />
            <div>
              <div style={{
                fontSize: '22px', fontWeight: 700,
                color: isDarkMode ? '#F1F5F9' : '#0F172A', marginBottom: '8px',
              }}>
                Connect Your Google Drive
              </div>
              <div style={{ fontSize: '14px', color: t.textSecondary, lineHeight: '1.6' }}>
                Link your personal Google Drive to browse all your files and folders,
                and chat with any document using AI.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', textAlign: 'left' }}>
              {[
                '📁 Browse your full My Drive — all files & folders',
                '🔍 Deep scan & search across everything',
                '🤖 Chat with any document using AI',
                '🔒 Only you can see your own files',
              ].map((item, i) => (
                <div key={i} style={{
                  fontSize: '13px', color: t.textSecondary,
                  background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(249,95,158,0.04)',
                  borderRadius: '10px', padding: '10px 14px',
                }}>
                  {item}
                </div>
              ))}
            </div>
            <button
              onClick={handleConnectDrive}
              disabled={connectLoading}
              style={{
                background: 'linear-gradient(135deg,#F95F9E,#FC9CBF)',
                color: '#fff', border: 'none', borderRadius: '14px',
                padding: '14px 0', fontSize: '15px', fontWeight: 700,
                cursor: connectLoading ? 'not-allowed' : 'pointer',
                opacity: connectLoading ? 0.75 : 1,
                boxShadow: '0 4px 20px rgba(249,95,158,0.32)',
                width: '100%', transition: 'opacity 0.2s',
              }}
            >
              {connectLoading ? 'Redirecting to Google…' : '🔗 Connect Google Drive'}
            </button>
          </div>
        </div>
      )}

      {/* ── CONNECTED — Main Drive UI ─────────────────────────────────── */}
      {driveConnected === true && (
        <div className="flex flex-1 overflow-hidden" style={{ paddingTop: '88px' }}>

          {/* Sidebar Overlay for Mobile */}
          {mobileSidebarOpen && (
            <div
              onClick={() => setMobileSidebarOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15,23,42,0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 998,
                animation: 'fadeUp 0.2s ease both',
              }}
            />
          )}

          {/* Floating FAB trigger for Mobile Sidebar */}
          <button
            className="mobile-sidebar-fab"
            onClick={() => setMobileSidebarOpen(true)}
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '24px',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#F95F9E,#FC9CBF)',
              color: 'white',
              border: 'none',
              boxShadow: '0 4px 16px rgba(249,95,158,0.4)',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 990,
              transition: 'all 0.2s',
            }}
          >
            <FolderIcon size={20} />
          </button>

          {/* ── SIDEBAR ──────────────────────────────────────────────── */}
          <aside
            className={`drive-sidebar-container ${mobileSidebarOpen ? 'open' : ''}`}
            style={{
              width: '252px', flexShrink: 0,
              borderRight: `1px solid ${t.border}`,
              height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              background: t.bgSidebar, backdropFilter: 'blur(20px)',
              transition: 'background 0.2s, border-color 0.2s, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '15px 16px', borderBottom: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontWeight: 700, fontSize: '13px', letterSpacing: '0.05em', color: '#F95F9E',
                display: 'flex', alignItems: 'center', gap: '7px',
              }}>
                <FolderIcon size={14} /> MY DRIVE
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => loadMyDrive(currentFolderId)}
                  title="Refresh"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px', borderRadius: '8px',
                    color: t.textSecondary,
                    animation: myDriveLoading ? 'spin 1s linear infinite' : 'none',
                  }}
                >
                  <RotateCw size={13} />
                </button>
                <button
                  className="mobile-sidebar-close"
                  onClick={() => setMobileSidebarOpen(false)}
                  title="Close sidebar"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px', borderRadius: '8px',
                    color: t.textSecondary,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Sidebar folder label */}
            <div style={{
              padding: '12px 16px 4px', fontSize: '10px', fontWeight: 600,
              color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.09em',
            }}>
              Folders
            </div>

            {/* Sidebar folder list — shows user's actual My Drive folders */}
            <div style={{ flex: 1, overflowY: 'auto' }} className="drive-sb">
              {myDriveLoading && myDriveFolders.length === 0 && (
                <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '12px', color: t.textSecondary }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', margin: '0 auto 8px',
                    border: '2px solid rgba(249,95,158,0.2)', borderTop: '2px solid #F95F9E',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Loading folders…
                </div>
              )}

              {!myDriveLoading && myDriveFolders.length === 0 && (
                <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '12px', color: t.textSecondary, lineHeight: 1.6 }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
                  No folders in My Drive root.
                </div>
              )}

              {myDriveFolders.map(folder => {
                const active = currentFolderId === folder.id;
                const isHov = hoveredFolder === folder.id;
                const iconInfo = getSidebarIconInfo(folder.name);
                return (
                  <div
                    key={folder.id}
                    className="sb-folder-row"
                    onMouseEnter={() => setHoveredFolder(folder.id)}
                    onMouseLeave={() => setHoveredFolder(null)}
                    onClick={() => handleFolderClick(folder)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '8px 12px 8px 10px',
                      cursor: 'pointer',
                      borderLeft: active ? `3px solid ${iconInfo.color}` : '3px solid transparent',
                      background: active
                        ? `${iconInfo.color}0e`
                        : isHov ? t.folderHov : 'transparent',
                      transition: 'all .15s',
                    }}
                  >
                    <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '9px', overflow: 'hidden' }}>
                      <span style={{
                        width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                        background: active ? iconInfo.bg : isHov ? iconInfo.bg : t.bgSecondary,
                        border: `1.5px solid ${active ? iconInfo.color + '40' : isHov ? iconInfo.color + '30' : t.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all .15s',
                      }}>
                        <SidebarFolderIcon
                          iconType={iconInfo.icon}
                          color={active || isHov ? iconInfo.color : t.textMuted}
                          size={17}
                        />
                      </span>
                      <span style={{
                        fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: active ? 600 : 400,
                        color: active ? iconInfo.color : t.textPrimary,
                        transition: 'color .15s', flex: 1,
                      }}>
                        {folder.name}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Deep Scan All button */}
            <div style={{ padding: '14px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <button
                className="scan-btn"
                onClick={handleDeepScan}
                disabled={scanStatus === 'running'}
                style={{
                  width: '100%', padding: '11px',
                  background: scanStatus === 'running'
                    ? t.scanDisabled
                    : 'linear-gradient(135deg,#F95F9E 0%,#FC9CBF 100%)',
                  color: scanStatus === 'running' ? t.textSecondary : 'white',
                  border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
                  cursor: scanStatus === 'running' ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  boxShadow: scanStatus === 'running' ? 'none' : '0 4px 14px rgba(249,95,158,0.35)',
                  transition: 'all .2s',
                }}
              >
                {scanStatus === 'running' ? (
                  <>
                    <span style={{
                      width: '14px', height: '14px', flexShrink: 0,
                      border: `2px solid ${isDarkMode ? 'rgba(249,95,158,0.18)' : 'rgba(249,95,158,0.2)'}`,
                      borderTop: '2px solid #F95F9E', borderRadius: '50%',
                      animation: 'spin 0.9s linear infinite',
                    }} />
                    Scanning…
                  </>
                ) : (
                  <><ScanLine size={14} /> Deep Scan All</>
                )}
              </button>
            </div>
          </aside>

          {/* ── MAIN PANEL ───────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Top bar */}
            <div
              className="drive-topbar"
              style={{
                padding: '10px 20px', borderBottom: `1px solid ${t.border}`,
                background: t.bgTopbar, backdropFilter: 'blur(18px)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                position: 'sticky', top: 0, zIndex: 20,
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              {/* Breadcrumb — shows Home > My Drive > FolderName */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 500, flexShrink: 0, flexWrap: 'wrap' }}>
                <Home
                  size={15}
                  onClick={() => { handleBreadcrumbClick({ id: 'root', name: 'My Drive' }, 0); setViewMode('myDrive'); }}
                  style={{ cursor: 'pointer', color: t.textSecondary }}
                />
                {folderBreadcrumb.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight size={13} style={{ color: t.textMuted }} />
                    <span
                      onClick={() => { handleBreadcrumbClick(crumb, idx); setViewMode('myDrive'); }}
                      style={{
                        cursor: 'pointer', transition: 'color .15s',
                        color: idx === folderBreadcrumb.length - 1 && viewMode === 'myDrive'
                          ? '#F95F9E' : t.textSecondary,
                        fontWeight: idx === folderBreadcrumb.length - 1 && viewMode === 'myDrive' ? 700 : 500,
                      }}
                    >
                      {crumb.name}
                    </span>
                  </React.Fragment>
                ))}
                {viewMode === 'scan' && (
                  <>
                    <ChevronRight size={13} style={{ color: t.textMuted }} />
                    <span style={{ color: '#F95F9E', fontWeight: 700 }}>Deep Scan Results</span>
                  </>
                )}
              </div>

              {/* Search bar */}
              <div className="drive-topbar-search" style={{ position: 'relative', width: '280px' }}>
                <Search size={14} style={{
                  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                  color: searchQuery ? '#F95F9E' : t.textMuted,
                  transition: 'color .15s', pointerEvents: 'none',
                }} />
                <input
                  type="text" placeholder="Search files…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="drive-search"
                  style={{
                    width: '100%', paddingLeft: '36px', paddingRight: '14px',
                    paddingTop: '9px', paddingBottom: '9px',
                    background: t.bgInput, border: `1.5px solid ${t.border}`,
                    borderRadius: '12px', fontSize: '13px',
                    color: t.textPrimary, boxSizing: 'border-box', transition: 'all .15s',
                  }}
                />
              </div>

              {/* Disconnect Drive button (replaces old "Google Drive Access" button) */}
              <button
                onClick={handleDisconnectDrive}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 16px',
                  background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                  color: t.textSecondary,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: '12px', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all .2s', flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,95,158,0.4)'; e.currentTarget.style.color = '#F95F9E'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}
              >
                <img src="/assets/google-drive.png" alt="Drive" style={{ width: '18px', height: '18px' }} />
                Disconnect Drive
              </button>
            </div>

            {/* Success toast */}
            {successMessage && (
              <div style={{
                position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 50, background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: 'white', padding: '12px 24px', borderRadius: '99px',
                display: 'flex', alignItems: 'center', gap: '10px',
                fontWeight: 600, fontSize: '14px',
                boxShadow: '0 8px 32px rgba(34,197,94,0.3)',
                animation: 'fadeUp .25s ease both',
              }}>
                <CheckCircle size={16} strokeWidth={3} /> {successMessage}
              </div>
            )}

            {/* Content area */}
            <div
              style={{ flex: 1, overflowY: 'auto' }}
              className="drive-sb"
              onScroll={(e) => {
                const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
                if (scrollHeight - scrollTop - clientHeight < 150) {
                  setVisibleCount(prev => prev + 60);
                }
              }}
            >

              {/* ── MY DRIVE VIEW ──────────────────────────────────── */}
              {viewMode === 'myDrive' && (
                <div style={{ padding: '20px' }}>

                  {myDriveLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0', color: t.textSecondary, fontSize: '14px' }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                        border: '2px solid rgba(249,95,158,0.2)', borderTop: '2px solid #F95F9E',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                      Loading your Drive…
                    </div>
                  )}

                  {/* Folders grid */}
                  {!myDriveLoading && myDriveFolders.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{
                        fontSize: '11px', fontWeight: 600, color: t.textMuted,
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
                      }}>
                        Folders ({myDriveFolders.length})
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill,minmax(175px,1fr))',
                        gap: '10px',
                      }}>
                        {myDriveFolders.map(folder => (
                          <div
                            key={folder.id}
                            onClick={() => handleFolderClick(folder)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '10px 14px',
                              background: t.bgSecondary, border: `1px solid ${t.border}`,
                              borderRadius: '12px', cursor: 'pointer', transition: 'all .15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,95,158,0.4)'; e.currentTarget.style.background = t.folderHov; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.bgSecondary; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                              <FolderIcon size={18} style={{ color: '#F95F9E', flexShrink: 0 }} />
                              <span style={{
                                fontSize: '13px', fontWeight: 500, color: t.textPrimary,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {folder.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files grid */}
                  {!myDriveLoading && myDriveFiles.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '11px', fontWeight: 600, color: t.textMuted,
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
                      }}>
                        Files ({myDriveFiles.length})
                      </div>
                      <div className="file-grid" style={{ padding: 0 }}>
                        {myDriveFiles.filter(f =>
                          !searchQuery || f.name?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).slice(0, visibleCount).map(file => (
                          <FileCard
                            key={file.id}
                            file={file}
                            searchQuery={searchQuery}
                            theme={t}
                            indexedDriveFileIds={indexedDriveFileIds}
                            backgroundDocuments={backgroundDocuments}
                            indexDriveFile={indexDriveFile}
                            retryDriveFileIndex={retryDriveFileIndex}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!myDriveLoading && myDriveFolders.length === 0 && myDriveFiles.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '80px 20px', animation: 'fadeUp .25s ease both' }}>
                      <div style={{ fontSize: '48px', marginBottom: '14px', opacity: 0.45 }}>📂</div>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: t.textPrimary, marginBottom: '6px' }}>
                        This folder is empty
                      </p>
                      <p style={{ fontSize: '13px', color: t.textSecondary }}>
                        No files or folders found here.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── SCAN VIEW ──────────────────────────────────────── */}
              {viewMode === 'scan' && (
                <div>
                  {/* Scan progress bar — shows during and after scan */}
                  {/* Premium Scan Status Card */}
                  {/* Premium Scan Status Card */}
                  {scanStatus !== 'idle' && (
                    <div style={{ padding: '24px', animation: 'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                      <div style={{
                        background: isDarkMode ? 'rgba(30, 41, 59, 0.65)' : 'rgba(255, 255, 255, 0.75)',
                        backdropFilter: 'blur(20px)',
                        border: '1.5px solid rgba(249, 95, 158, 0.28)',
                        borderRadius: '24px',
                        padding: '28px',
                        boxShadow: '0 8px 32px rgba(249, 95, 158, 0.12), inset 0 1px 2px rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                      }}>
                        {/* Header Row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '42px', height: '42px', borderRadius: '12px',
                              background: 'rgba(249, 95, 158, 0.15)',
                              border: '1px solid rgba(249, 95, 158, 0.25)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {scanStatus === 'running' ? (
                                <div style={{
                                  width: '20px', height: '20px', borderRadius: '50%',
                                  border: '2.5px solid rgba(249,95,158,0.18)',
                                  borderTop: '2.5px solid #F95F9E',
                                  animation: 'spin 0.9s linear infinite',
                                }} />
                              ) : scanStatus === 'complete' ? (
                                <CheckCircle size={20} style={{ color: '#22c55e' }} />
                              ) : (
                                <X size={20} style={{ color: '#ef4444' }} />
                              )}
                            </div>
                            <div>
                              <h3 style={{ fontSize: '16px', fontWeight: 700, color: t.textPrimary, margin: 0 }}>
                                {backendStatus === 'queued' && 'Queued in scan worker pool...'}
                                {backendStatus === 'connecting' && 'Connecting to Google Drive...'}
                                {backendStatus === 'fetching' && 'Fetching Drive directory structure...'}
                                {backendStatus === 'scanning' && 'Traversing & Scanning Directories...'}
                                {backendStatus === 'indexing' && 'Optimizing & Indexing Documents...'}
                                {(backendStatus === 'completed' || backendStatus === 'complete' || scanStatus === 'complete') && 'Deep Scan & Indexing Complete!'}
                                {(backendStatus === 'failed' || scanStatus === 'failed') && 'Deep Scan Failed'}
                                {(backendStatus === 'cancelled' || scanStatus === 'cancelled') && 'Deep Scan Interrupted / Cancelled'}
                                {!backendStatus && scanStatus === 'running' && 'Scanning Google Drive...'}
                              </h3>
                              <p style={{
                                fontSize: '12px', color: t.textSecondary,
                                margin: '4px 0 0', maxWidth: '480px',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {scanStatus === 'cancelled'
                                  ? 'Scan interrupted due to server reload/restart.'
                                  : (scanProgress.current_file ? `📂 ${scanProgress.current_file}` : 'Waiting for traversal response...')}
                              </p>
                            </div>
                          </div>

                          <div style={{
                            fontSize: '14px', fontWeight: 800, color: '#F95F9E',
                            background: 'rgba(249,95,158,0.12)', border: '1px solid rgba(249,95,158,0.2)',
                            padding: '6px 14px', borderRadius: '12px'
                          }}>
                            {scanStatus === 'complete' ? '100%' : `${scanProgress.progress || 0}%`}
                          </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{
                            height: '8px', background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                            borderRadius: '99px', overflow: 'hidden', position: 'relative'
                          }}>
                            <div style={{
                              height: '100%',
                              width: scanStatus === 'complete' ? '100%' : `${scanProgress.progress || 0}%`,
                              background: 'linear-gradient(90deg,#F95F9E,#FC9CBF)',
                              borderRadius: '99px',
                              boxShadow: '0 0 12px rgba(249,95,158,0.6)',
                              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                              animation: (scanStatus === 'running' && backendStatus === 'scanning') ? 'indeterminate 1.6s infinite' : 'none',
                            }} />
                          </div>
                        </div>

                        {/* Live Counts Dashboard Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '14px',
                          marginTop: '4px'
                        }}>
                          {/* Folders count */}
                          <div style={{
                            background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(249,95,158,0.02)',
                            border: `1px solid ${t.border}`,
                            borderRadius: '16px', padding: '14px',
                            display: 'flex', flexDirection: 'column', gap: '4px'
                          }}>
                            <span style={{ fontSize: '11px', color: t.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Folders Scanned
                            </span>
                            <span style={{ fontSize: '20px', fontWeight: 800, color: t.textPrimary }}>
                              {scanProgress.folder_count || 0}
                            </span>
                          </div>

                          {/* Files count */}
                          <div style={{
                            background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(249,95,158,0.02)',
                            border: `1px solid ${t.border}`,
                            borderRadius: '16px', padding: '14px',
                            display: 'flex', flexDirection: 'column', gap: '4px'
                          }}>
                            <span style={{ fontSize: '11px', color: t.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Files Discovered
                            </span>
                            <span style={{ fontSize: '20px', fontWeight: 800, color: t.textPrimary }}>
                              {scanProgress.file_count || 0}
                            </span>
                          </div>
                        </div>

                        {/* Footer Action for Failed/Cancelled */}
                        {(scanStatus === 'failed' || scanStatus === 'cancelled') && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginTop: '10px' }}>
                            <button
                              onClick={startPersistentDeepScan}
                              className="scan-btn"
                              style={{
                                padding: '10px 24px',
                                background: 'linear-gradient(135deg,#F95F9E,#FC9CBF)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 14px rgba(249,95,158,0.30)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <RotateCw size={14} />
                              Restart Scan
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                  {/* Header info */}
                  <div style={{
                    padding: '12px 20px', borderBottom: `1px solid ${t.border}`,
                    background: t.resultHeader,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}>
                    <FileSearch size={14} style={{ color: '#F95F9E' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: t.textPrimary }}>
                      Deep Scan Results
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      background: 'rgba(249,95,158,0.12)', color: '#F95F9E',
                      padding: '2px 9px', borderRadius: '99px',
                    }}>
                      {displayFiles.length} file{displayFiles.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Empty state or list */}
                  {displayFiles.length === 0 && scanStatus !== 'running' && scanStatus !== 'failed' && scanStatus !== 'cancelled' ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px', animation: 'fadeUp .25s ease both' }}>
                      <div style={{ fontSize: '52px', marginBottom: '16px', opacity: 0.45 }}>📂</div>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: t.textPrimary, marginBottom: '6px' }}>
                        No scan results
                      </p>
                      <p style={{ fontSize: '13px', color: t.textSecondary, maxWidth: '320px', margin: '0 auto 20px', lineHeight: 1.6 }}>
                        Deep scan finds all files in your Google Drive root and nested folders so you can search them.
                      </p>
                      <button
                        onClick={handleDeepScan}
                        style={{
                          padding: '10px 28px',
                          background: 'linear-gradient(135deg,#F95F9E,#FC9CBF)',
                          color: 'white', border: 'none', borderRadius: '12px',
                          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(249,95,158,0.30)',
                        }}
                      >
                        Start Deep Scan
                      </button>
                    </div>
                  ) : (
                    <div className="file-grid">
                      {displayFiles.slice(0, visibleCount).map(file => (
                        <FileCard
                          key={file.id}
                          file={file}
                          searchQuery={searchQuery}
                          theme={t}
                          indexedDriveFileIds={indexedDriveFileIds}
                          backgroundDocuments={backgroundDocuments}
                          indexDriveFile={indexDriveFile}
                          retryDriveFileIndex={retryDriveFileIndex}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


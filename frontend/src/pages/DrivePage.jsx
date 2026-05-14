import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedNavbar from '../components/SharedNavbar';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import driveLogo from "/assets/google-drive.png";

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
const FileCard = ({ file, searchQuery, theme }) => {
  const [hov, setHov] = useState(false);
  const typeInfo = getFileTypeInfo(file.mimeType, file.name);
  const fullPath = file.full_path || file.folderPath || 'NEXORA';

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

        {/* Extension badge — pill shaped with bold color */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px',
        }}>
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
  );
};

// ─── DrivePage ────────────────────────────────────────────────────────────────
export default function DrivePage() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { confirm } = useDialog();
  const theme = getTheme(isDarkMode);

  const getToken = async () => {
    const { getAuth } = await import('firebase/auth')
    const user = getAuth().currentUser
    if (user) return await user.getIdToken(true)
    return localStorage.getItem('nexora_token')
  }

  const [sidebarFolders, setSidebarFolders] = useState([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [currentFiles, setCurrentFiles] = useState([]);
  const [currentFolderName, setCurrentFolderName] = useState('Nexora');
  const [viewMode, setViewMode] = useState('scan');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderCreating, setFolderCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hoveredFolder, setHoveredFolder] = useState(null);
  const [scannedFiles, setScannedFiles] = useState([]);
  const [scanStatus, setScanStatus] = useState('idle');
  const [scanProgress, setScanProgress] = useState({ scanned: 0, total: 0, current_file: '' });

  const pollRef = useRef(null);
  const hasScanRun = useRef(false);
  const foldersLoadedRef = useRef(false);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('nexora_scan_files');
      const cachedStatus = sessionStorage.getItem('nexora_scan_status');
      if (cached && cachedStatus === 'complete') {
        const files = JSON.parse(cached);
        if (files.length > 0) { setScannedFiles(files); setScanStatus('complete'); hasScanRun.current = true; }
      }
    } catch (e) { }
    if (!foldersLoadedRef.current) { foldersLoadedRef.current = true; loadSidebarFolders(); }
    if (!hasScanRun.current) { hasScanRun.current = true; scanFiles(); }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, []);

  const loadSidebarFolders = async () => {
    try {
      setSidebarLoading(true);
      const freshToken = await getToken()
      const res = await fetch('http://localhost:8000/api/drive/folders', { headers: { Authorization: `Bearer ${freshToken}` } });
      const data = await res.json();
      const folders = data.folders || data || [];
      setSidebarFolders(Array.isArray(folders) ? folders : []);
    } catch (err) { console.error('Sidebar folders error:', err); }
    finally { setSidebarLoading(false); }
  };

  const handleRefreshFolders = () => {
    foldersLoadedRef.current = false; loadSidebarFolders(); foldersLoadedRef.current = true;
  };

  const scanFiles = async () => {
    try {
      setScanStatus('running');
      const freshToken = await getToken()
      const response = await fetch('http://localhost:8000/api/drive/scan', {
        method: 'POST', headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Scan failed: ${response.status}`);
      const { job_id } = await response.json();
      if (!job_id) throw new Error('No job_id received');

      const interval = setInterval(async () => {
        try {
          const loopToken = await getToken()
          const statusRes = await fetch(`http://localhost:8000/api/drive/scan/${job_id}`, { headers: { Authorization: `Bearer ${loopToken}` } });
          const status = await statusRes.json();
          setScanProgress(status);
          if (status.files?.length > 0) setScannedFiles(status.files);
          if (status.status === 'complete' || status.status === 'failed') {
            clearInterval(interval);
            setScanStatus(status.status);
            setScannedFiles(status.files || []);
            if (status.status === 'complete') {
              try { sessionStorage.setItem('nexora_scan_files', JSON.stringify(status.files || [])); sessionStorage.setItem('nexora_scan_status', 'complete'); } catch (e) { }
            }
          }
        } catch (e) { clearInterval(interval); setScanStatus('failed'); }
      }, 2000);
    } catch (e) { setScanStatus('failed'); }
  };

  const handleFolderClick = async (folder) => {
    try {
      setScanStatus('idle');
      const freshToken = await getToken()
      const res = await fetch(`http://localhost:8000/api/drive/folders/${folder.id}/contents`, { headers: { Authorization: `Bearer ${freshToken}` } });
      const data = await res.json();
      setCurrentFiles(data.files || []);
      setCurrentFolderName(folder.name);
      setViewMode('folder');
    } catch (err) { console.error('Folder contents error:', err); }
  };

  const handleBackToRoot = () => { setViewMode('scan'); setCurrentFolderName('Nexora'); };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setFolderCreating(true); // ← ADD
    try {
      const freshToken = await getToken()
      const res = await fetch('http://localhost:8000/api/drive/folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({ name }),
      });
      if (res.ok) { setNewFolderName(''); setShowFolderInput(false); await loadSidebarFolders(); flashSuccess(`Folder "${name}" created`); }
    } catch (err) { console.error('Create folder error:', err); }
    finally { setFolderCreating(false); } // ← ADD
  };

  const handleDelete = async (itemId, itemName) => {
    const ok = await confirm(`Permanently delete "${itemName}" from Drive?`);
    if (!ok) return;
    setDeletingId(itemId); // ← ADD
    try {
      const freshToken = await getToken()
      const res = await fetch(`http://localhost:8000/api/drive/items/${itemId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${freshToken}` } });
      if (res.ok) {
        setSidebarFolders(p => p.filter(f => f.id !== itemId));
        setScannedFiles(p => p.filter(f => f.id !== itemId));
        setCurrentFiles(p => p.filter(f => f.id !== itemId));
        flashSuccess(`"${itemName}" deleted`);
      }
    } catch (err) { console.error('Delete error:', err); }
    finally { setDeletingId(null); } // ← ADD
  };

  const flashSuccess = (msg) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(''), 3000); };

  const displayFiles = (viewMode === 'scan' ? scannedFiles : currentFiles).filter(f =>
    !searchQuery ||
    f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.full_path || f.folderPath || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="app-background flex flex-col h-screen"
      style={{ fontFamily: '"Inter",sans-serif', color: theme.textPrimary, transition: 'color 0.2s' }}
    >
      <SharedNavbar />

      <style>{`
        @keyframes spin          { to { transform: rotate(360deg); } }
        @keyframes fadeUp        { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes indeterminate { 0% { transform:translateX(-100%); width:35%; } 100% { transform:translateX(320%); width:35%; } }

        .drive-sb::-webkit-scrollbar        { width:4px; }
        .drive-sb::-webkit-scrollbar-track  { background:transparent; }
        .drive-sb::-webkit-scrollbar-thumb  { background:rgba(249,95,158,0.28); border-radius:99px; }

        .drive-search:focus {
          outline: none;
          border-color: #F95F9E !important;
          box-shadow: 0 0 0 3px rgba(249,95,158,0.14);
        }
        .drive-search::placeholder,
        .drive-folder-input::placeholder { color:#94A3B8; }

        .scan-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(249,95,158,0.42) !important;
        }
        .file-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px,1fr));
          gap: 16px;
          padding: 20px;
          animation: fadeUp .22s ease both;
        }
        .sb-folder-row:hover .sb-delete-btn { opacity: 1 !important; }
      `}</style>

      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: '88px' }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <aside style={{
          width: '252px', flexShrink: 0,
          borderRight: `1px solid ${theme.border}`,
          height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: theme.bgSidebar,
          backdropFilter: 'blur(20px)',
          transition: 'background 0.2s, border-color 0.2s',
        }}>

          {/* Header */}
          <div style={{
            padding: '15px 16px', borderBottom: `1px solid ${theme.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontWeight: 700, fontSize: '13px', letterSpacing: '0.05em', color: '#F95F9E',
              display: 'flex', alignItems: 'center', gap: '7px',
            }}>
              <FolderIcon size={14} /> NEXORA DRIVE
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={handleRefreshFolders} title="Refresh" style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px',
                color: theme.textSecondary, transition: 'all .15s',
                animation: sidebarLoading ? 'spin 1s linear infinite' : 'none',
              }}><RotateCw size={13} /></button>
              <button onClick={() => setShowFolderInput(v => !v)} title="New folder" style={{
                background: showFolderInput ? 'rgba(249,95,158,0.14)' : 'none',
                border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px',
                color: showFolderInput ? '#F95F9E' : theme.textSecondary, transition: 'all .15s',
              }}><Plus size={13} /></button>
            </div>
          </div>

          {/* New folder input */}
          {showFolderInput && (
            <div style={{
              padding: '10px 12px', borderBottom: `1px solid ${theme.border}`,
              display: 'flex', gap: '6px', animation: 'fadeUp .2s ease both',
            }}>

              <input
                value={newFolderName} autoFocus
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                placeholder="Folder name…"
                disabled={folderCreating}
                className="drive-folder-input"
                style={{
                  flex: 1, padding: '7px 10px', fontSize: '12px',
                  background: theme.bgInput,
                  border: `1.5px solid ${theme.border}`,
                  borderRadius: '9px', color: theme.textPrimary,
                  outline: 'none', transition: 'border .15s',
                  opacity: folderCreating ? 0.5 : 1,   /* ← ADD */
                  cursor: folderCreating ? 'not-allowed' : 'text',  /* ← ADD */
                }}
              />
              <button
                onClick={handleCreateFolder}
                disabled={folderCreating}
                style={{
                  padding: '7px 14px',
                  background: folderCreating
                    ? (isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9')
                    : 'linear-gradient(135deg,#F95F9E,#FC9CBF)',
                  color: folderCreating ? theme.textSecondary : 'white',
                  border: 'none', borderRadius: '9px',
                  fontSize: '12px', fontWeight: 600,
                  cursor: folderCreating ? 'not-allowed' : 'pointer',
                  boxShadow: folderCreating ? 'none' : '0 2px 8px rgba(249,95,158,0.30)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.2s',
                  minWidth: '58px', justifyContent: 'center',
                }}
              >
                {folderCreating ? (
                  <>
                    <span style={{
                      width: '11px', height: '11px', flexShrink: 0,
                      border: `2px solid ${isDarkMode ? 'rgba(249,95,158,0.18)' : 'rgba(249,95,158,0.20)'}`,
                      borderTop: '2px solid #F95F9E',
                      borderRadius: '50%',
                      animation: 'spin 0.9s linear infinite',
                      display: 'inline-block',
                    }} />
                    Adding
                  </>
                ) : 'Add'}
              </button>
            </div>
          )}

          {/* Folders label */}
          <div style={{
            padding: '12px 16px 4px', fontSize: '10px', fontWeight: 600,
            color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.09em',
          }}>Folders</div>

          {/* Folder list */}
          <div style={{ flex: 1, overflowY: 'auto' }} className="drive-sb">
            {sidebarFolders.length === 0 && !sidebarLoading && (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '12px', color: theme.textSecondary, lineHeight: 1.6 }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
                No folders found.<br />Share NEXORA with service account.
              </div>
            )}

            {sidebarFolders.map(folder => {
              const active = currentFolderName === folder.name;
              const isHov = hoveredFolder === folder.id;
              const iconInfo = getSidebarIconInfo(folder.name);

              return (
                <div
                  key={folder.id}
                  className="sb-folder-row"
                  onMouseEnter={() => setHoveredFolder(folder.id)}
                  onMouseLeave={() => setHoveredFolder(null)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '8px 12px 8px 10px',
                    cursor: 'pointer',
                    borderLeft: active ? `3px solid ${iconInfo.color}` : '3px solid transparent',
                    background: active
                      ? `${iconInfo.color}0e`
                      : isHov ? theme.folderHov : 'transparent',
                    opacity: deletingId === folder.id ? 0.45 : 1,
                    transition: 'all .15s, opacity .2s',
                    pointerEvents: deletingId === folder.id ? 'none' : 'auto',
                    transition: 'all .15s',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '9px', overflow: 'hidden' }}
                    onClick={() => handleFolderClick(folder)}
                  >
                    {/* Format-specific icon box */}
                    <span style={{
                      width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                      background: active ? iconInfo.bg : isHov ? iconInfo.bg : theme.bgSecondary,
                      border: `1.5px solid ${active ? iconInfo.color + '40' : isHov ? iconInfo.color + '30' : theme.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}>
                      <SidebarFolderIcon
                        iconType={iconInfo.icon}
                        color={active || isHov ? iconInfo.color : theme.textMuted}
                        size={17}
                      />
                    </span>

                    <span style={{
                      fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: active ? 600 : 400,
                      color: active ? iconInfo.color : theme.textPrimary,
                      transition: 'color .15s',
                      flex: 1,
                    }}>
                      {folder.name}
                    </span>

                    {folder.file_count !== undefined && (
                      <span style={{
                        fontSize: '10px', flexShrink: 0,
                        color: active ? iconInfo.color : theme.textSecondary,
                        background: active ? `${iconInfo.color}14` : theme.bgSecondary,
                        padding: '1px 7px', borderRadius: '99px',
                        fontWeight: 500,
                        transition: 'all .15s',
                      }}>{folder.file_count}</span>
                    )}
                  </span>

                  <button
                    className="sb-delete-btn"
                    onClick={e => { e.stopPropagation(); handleDelete(folder.id, folder.name); }}
                    disabled={deletingId === folder.id}
                    style={{
                      background: 'none', border: 'none',
                      cursor: deletingId === folder.id ? 'not-allowed' : 'pointer',
                      padding: '3px 4px',
                      color: '#ef4444',
                      opacity: deletingId === folder.id ? 1 : 0, // stays visible while deleting
                      transition: 'opacity .15s',
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '20px', height: '20px',
                    }}
                  >
                    {deletingId === folder.id ? (
                      <span style={{
                        width: '11px', height: '11px',
                        border: '2px solid rgba(239,68,68,0.20)',
                        borderTop: '2px solid #ef4444',
                        borderRadius: '50%',
                        animation: 'spin 0.9s linear infinite',
                        display: 'inline-block',
                        flexShrink: 0,
                      }} />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Deep Scan All */}
          <div style={{ padding: '14px', borderTop: `1px solid ${theme.border}`, flexShrink: 0 }}>
            <button
              className="scan-btn"
              onClick={scanFiles}
              disabled={scanStatus === 'running'}
              style={{
                width: '100%', padding: '11px',
                background: scanStatus === 'running' ? theme.scanDisabled : 'linear-gradient(135deg,#F95F9E 0%,#FC9CBF 100%)',
                color: scanStatus === 'running' ? theme.textSecondary : 'white',
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
                    borderTop: '2px solid #F95F9E',
                    borderRadius: '50%', animation: 'spin 0.9s linear infinite',
                  }} />
                  Scanning…
                </>
              ) : (
                <><ScanLine size={14} /> Deep Scan All</>
              )}
            </button>
          </div>
        </aside>

        {/* ── MAIN PANEL ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Top bar */}
          <div style={{
            padding: '10px 20px', borderBottom: `1px solid ${theme.border}`,
            background: theme.bgTopbar, backdropFilter: 'blur(18px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            position: 'sticky', top: 0, zIndex: 20, transition: 'background 0.2s, border-color 0.2s',
          }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, flexShrink: 0 }}>
              <Home size={15} onClick={handleBackToRoot}
                style={{ cursor: 'pointer', color: theme.textSecondary }} />
              <ChevronRight size={13} style={{ color: theme.textMuted }} />
              <span onClick={handleBackToRoot} style={{
                cursor: 'pointer', transition: 'color .15s',
                color: viewMode === 'scan' ? '#F95F9E' : theme.textSecondary,
                fontWeight: viewMode === 'scan' ? 700 : 500,
              }}>NEXORA</span>
              {viewMode === 'folder' && (
                <>
                  <ChevronRight size={13} style={{ color: theme.textMuted }} />
                  <span style={{ color: '#F95F9E', fontWeight: 700 }}>{currentFolderName}</span>
                </>
              )}
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={14} style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                color: searchQuery ? '#F95F9E' : theme.textMuted,
                transition: 'color .15s', pointerEvents: 'none',
              }} />
              <input
                type="text" placeholder="Search files…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="drive-search"
                style={{
                  width: '100%', paddingLeft: '36px', paddingRight: '14px',
                  paddingTop: '9px', paddingBottom: '9px',
                  background: theme.bgInput,
                  border: `1.5px solid ${theme.border}`,
                  borderRadius: '12px', fontSize: '13px',
                  color: theme.textPrimary, boxSizing: 'border-box',
                  transition: 'all .15s',
                }}
              />
            </div>

            {/* Google Drive Access Button */}
            <button
              onClick={() =>
                window.open('https://drive.google.com/drive/folders/1Rk79CKFOtQcSlndD2fMgsjo-KI431lx6', '_blank')
              }
              className="upload-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                background: 'linear-gradient(135deg, #F95F9E, #FC9CBF)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 3px 12px rgba(249,95,158,0.30)',
                transition: 'all .2s',
                flexShrink: 0,
                border: 'none',
                outline: 'none',
              }}
            >
              <img
                src={driveLogo}
                alt="Google Drive"
                style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }}
              />
              Google Drive Access
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

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto' }} className="drive-sb">

            {/* Scanning progress */}
            {scanStatus === 'running' && (
              <div style={{ padding: '28px 24px 16px', animation: 'fadeUp .2s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                  <span style={{
                    width: '22px', height: '22px', flexShrink: 0,
                    border: `2.5px solid ${isDarkMode ? 'rgba(249,95,158,0.14)' : 'rgba(249,95,158,0.18)'}`,
                    borderTop: '2.5px solid #F95F9E',
                    borderRadius: '50%', animation: 'spin 0.9s linear infinite',
                  }} />
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary, margin: 0 }}>
                      Scanning NEXORA Drive…
                    </p>
                    {scanProgress.total > 0 && (
                      <p style={{ fontSize: '12px', color: '#F95F9E', margin: '3px 0 0', fontWeight: 500 }}>
                        {scanProgress.scanned} of {scanProgress.total} files
                      </p>
                    )}
                    {scanProgress.current_file && (
                      <p style={{
                        fontSize: '11px', color: theme.textSecondary,
                        margin: '2px 0 0', maxWidth: '420px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {scanProgress.current_file}
                      </p>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: '5px', background: theme.scanBarBg, borderRadius: '99px', overflow: 'hidden', maxWidth: '500px' }}>
                  <div style={{
                    height: '100%',
                    width: scanProgress.total > 0 ? `${(scanProgress.scanned / scanProgress.total) * 100}%` : '30%',
                    background: 'linear-gradient(90deg,#F95F9E,#FC9CBF)',
                    borderRadius: '99px', transition: 'width .4s ease',
                    animation: scanProgress.total === 0 ? 'indeterminate 1.6s infinite' : 'none',
                  }} />
                </div>
                {scannedFiles.length > 0 && (
                  <p style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '10px' }}>
                    {scannedFiles.length} file(s) found so far…
                  </p>
                )}
              </div>
            )}

            {/* File cards */}
            {(scanStatus === 'complete' || scannedFiles.length > 0 || viewMode === 'folder') && (
              <div>
                {/* Result header */}
                <div style={{
                  padding: '13px 20px', borderBottom: `1px solid ${theme.border}`,
                  background: theme.resultHeader,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'background 0.2s, border-color 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileSearch size={14} style={{ color: '#F95F9E' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: theme.textPrimary }}>
                      {viewMode === 'scan' ? 'Deep Scan Results' : currentFolderName}
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      background: 'rgba(249,95,158,0.12)', color: '#F95F9E',
                      padding: '2px 9px', borderRadius: '99px',
                    }}>
                      {displayFiles.length} file{displayFiles.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {viewMode === 'folder' && (
                    <button onClick={handleBackToRoot} style={{
                      fontSize: '12px', fontWeight: 500, color: '#F95F9E',
                      background: 'rgba(249,95,158,0.09)', border: '1px solid rgba(249,95,158,0.22)',
                      borderRadius: '8px', padding: '4px 12px', cursor: 'pointer',
                    }}>← All files</button>
                  )}
                </div>

                {/* Empty state */}
                {displayFiles.length === 0 && scanStatus !== 'running' ? (
                  <div style={{ textAlign: 'center', padding: '80px 20px', animation: 'fadeUp .25s ease both' }}>
                    <div style={{ fontSize: '52px', marginBottom: '16px', opacity: 0.45 }}>📂</div>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: theme.textPrimary, marginBottom: '6px' }}>
                      {searchQuery ? 'No files match your search' : 'No files found'}
                    </p>
                    <p style={{ fontSize: '13px', color: theme.textSecondary, lineHeight: 1.7 }}>
                      {searchQuery ? 'Try a different keyword.' : 'Add files to NEXORA on Google Drive\nthen click Deep Scan All.'}
                    </p>
                  </div>
                ) : (
                  <div className="file-grid">
                    {displayFiles.map(file => (
                      <FileCard
                        key={file.id || file.drive_id}
                        file={file}
                        searchQuery={searchQuery}
                        theme={theme}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Failed */}
            {scanStatus === 'failed' && scannedFiles.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 20px', animation: 'fadeUp .25s ease both' }}>
                <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚠️</div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444', marginBottom: '8px' }}>Scan failed</p>
                <p style={{ fontSize: '12px', color: theme.textSecondary, lineHeight: 1.8 }}>
                  Make sure NEXORA is shared with:<br />
                  <code style={{ fontSize: '11px', background: theme.codeBlock, color: theme.textPrimary, padding: '2px 7px', borderRadius: '5px' }}>
                    drive-accessor@nexora-project-495714.iam.gserviceaccount.com
                  </code>
                </p>
                <button onClick={scanFiles} style={{
                  marginTop: '20px', padding: '10px 28px',
                  background: 'linear-gradient(135deg,#F95F9E,#FC9CBF)',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(249,95,158,0.30)',
                }}>
                  Retry Scan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
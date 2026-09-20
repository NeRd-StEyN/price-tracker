import React from 'react';
import { Headphones, Monitor, Laptop, Keyboard, Watch, Package, Server, ShieldAlert, Clock, AlertTriangle, FileSearch } from 'lucide-react';

export function formatPrice(amount) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatRelativeTime(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function formatExactTime(dateString) {
  if (!dateString) return 'No timestamp';
  return new Date(dateString).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });
}

export function getCategoryIcon(category) {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('audio') || cat.includes('headphone') || cat.includes('earbud')) return Headphones;
  if (cat.includes('monitor') || cat.includes('display')) return Monitor;
  if (cat.includes('laptop') || cat.includes('computer') || cat.includes('workstation')) return Laptop;
  if (cat.includes('peripheral') || cat.includes('keyboard') || cat.includes('mouse') || cat.includes('stream')) return Keyboard;
  if (cat.includes('wearable') || cat.includes('glass') || cat.includes('watch')) return Watch;
  return Package;
}

export function mapErrorToFriendlyText(errorCode, rawMessage) {
  const code = (errorCode || '').toUpperCase();
  const msg = (rawMessage || '').toUpperCase();

  if (code === 'PRICE_PENDING' || msg.includes('PRICE_PENDING')) {
    return 'Store price was still updating';
  }
  if (code === '503' || msg.includes('503') || msg.includes('SERVICE UNAVAILABLE')) {
    return 'Store temporarily unavailable';
  }
  if (code === 'TIMEOUT' || msg.includes('TIMEOUT') || msg.includes('ABORT')) {
    return 'Request timed out waiting for store response';
  }
  if (code === 'STRUCTURE_CHANGED' || msg.includes('STRUCTURE_CHANGED')) {
    return 'Store page format changed';
  }
  if (code === 'SESSION_REJECTED' || msg.includes('SESSION_REJECTED')) {
    return 'Store anti-bot session rejected';
  }
  if (code === 'NOT_FOUND' || msg.includes('404')) {
    return 'Product no longer exists on store';
  }
  return rawMessage || 'Scrape operation failed';
}

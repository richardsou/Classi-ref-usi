import { Shift } from "./types";

export const SHIFTS: Shift[] = ['Turno 1', 'Turno 2', 'Turno 3'];

export const SHIFT_COLORS: Record<Shift, string> = {
  'Turno 1': '#2563eb',
  'Turno 2': '#d97706',
  'Turno 3': '#059669'
};

export const SUGGESTED_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#d946ef', // Fuchsia
  '#8b5cf6', // Purple
  '#f43f5e', // Rose
];
